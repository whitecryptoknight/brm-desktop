import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import type { IpcMain, BrowserWindow, WebContents } from "electron";
import { getStoredToken } from "./auth";

const BRM_API = process.env.BRM_API_URL ?? "https://dev.brmb.support";

interface TransferRequest {
  registrationId: number;
  registrationType: "sd" | "digital";
  deviceMountpoint: string;
}

async function downloadToFile(url: string, destPath: string, sender: WebContents, label: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label}: ${res.status}`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  let downloaded = 0;

  const reader = res.body?.getReader();
  if (!reader) throw new Error(`No response body for ${label}`);

  const nodeReadable = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        downloaded += value.length;
        if (contentLength > 0) {
          sender.send("transfer:file-progress", { label, percent: Math.round((downloaded / contentLength) * 100) });
        }
        this.push(Buffer.from(value));
      }
    },
  });

  await pipeline(nodeReadable, createWriteStream(destPath));
}

export function registerTransferHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("transfer:start", async (event, req: TransferRequest) => {
    const stored = getStoredToken();
    if (!stored) return { error: "Not logged in" };

    const sender = event.sender as WebContents;
    const send = (stage: string, percent: number) => sender.send("transfer:progress", { stage, percent });

    try {
      // 1. Fetch fresh registrations + signed URLs
      send("Fetching map data...", 0);
      const regRes = await fetch(`${BRM_API}/api/desktop/registrations`, {
        headers: { "X-Customer-Token": stored.token },
      });
      if (!regRes.ok) return { error: "Could not load registration data" };

      const { sdRegistrations, digitalRegistrations } = await regRes.json() as {
        sdRegistrations: SdReg[];
        digitalRegistrations: DigitalReg[];
      };

      const reg = req.registrationType === "sd"
        ? sdRegistrations.find((r) => r.id === req.registrationId)
        : digitalRegistrations.find((r) => r.id === req.registrationId);

      if (!reg) return { error: "Registration not found" };

      const maps = (reg as SdReg | DigitalReg).maps;
      const platform = process.platform === "darwin" ? "mac" : "pc";

      // 2. Resolve download URLs
      const imgUrl = platform === "mac" ? maps.mac_download_path : maps.pc_download_path;
      const unlUrl = (reg as SdReg).unl_file_url ?? (reg as DigitalReg).unl_file_url;
      const gmaUrl = (reg as SdReg).companion_file_url ?? (reg as DigitalReg).gma_file_url;
      const gpiUrl = maps.gpi_path;

      if (!imgUrl) return { error: "Map download path not available for your platform" };

      // 3. Ensure target directories exist
      const garminDir = join(req.deviceMountpoint, "Garmin");
      const poiDir = join(garminDir, "POI");
      mkdirSync(garminDir, { recursive: true });
      if (gpiUrl) mkdirSync(poiDir, { recursive: true });

      // 4. Download and write each file
      send("Downloading map file...", 5);
      await downloadToFile(imgUrl, join(garminDir, "gmapsupp.img"), sender, "Map file");

      send("Downloading license...", 60);
      if (unlUrl) await downloadToFile(unlUrl, join(garminDir, "gmapsupp.unl"), sender, "License file");

      send("Downloading activation file...", 75);
      if (gmaUrl) await downloadToFile(gmaUrl, join(garminDir, `${maps.acronym ?? reg.map_number}.gma`), sender, "Activation file");

      send("Downloading POI file...", 88);
      if (gpiUrl) await downloadToFile(gpiUrl, join(poiDir, `${maps.acronym ?? reg.map_number}.gpi`), sender, "POI file");

      send("Done", 100);
      return { success: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Transfer failed" };
    }
  });
}

interface MapMeta {
  name: string;
  acronym: string;
  pc_download_path: string;
  mac_download_path: string;
  gpi_path: string;
}

interface SdReg {
  id: number;
  map_number: string;
  esn: string;
  unl_file_url: string;
  companion_file_url: string;
  maps: MapMeta;
}

interface DigitalReg {
  id: number;
  map_number: string;
  gps_unit_id: string;
  unl_file_url: string;
  gma_file_url: string;
  maps: MapMeta;
}

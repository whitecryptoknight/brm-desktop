import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import AdmZip from "adm-zip";
import type { IpcMain, WebContents } from "electron";
import { getStoredToken } from "./auth";

const BRM_API = process.env.BRM_API_URL ?? "https://brm.dev.digitalbitz.cc";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface TransferRequest {
  registrationId: number;
  registrationType: "sd" | "digital";
  deviceMountpoint: string;
}

interface BasecampRequest {
  pcDownloadUrl: string;
  macDownloadUrl: string;
  mapName: string;
  mapAcronym?: string;
  gmaFileUrl?: string;
  unlFileUrl?: string;
}

interface MapMeta {
  name: string;
  acronym: string;
  version: string;
  img_path: string;
  pc_download_path: string;
  mac_download_path: string;
  pc_update_path_sd: string;
  pc_update_path_digital: string;
  poi_update_path: string;
}

interface SdReg {
  id: number;
  map_number: string;
  esn: string;
  unl_file_url: string;
  companion_file_url: string;
  maps: MapMeta | MapMeta[];
}

interface DigitalReg {
  id: number;
  map_number: string;
  gps_unit_id: string;
  unl_file_url: string;
  gma_file_url: string;
  maps: MapMeta | MapMeta[];
}

function resolveMap(maps: MapMeta | MapMeta[] | null | undefined): MapMeta | null {
  if (!maps) return null;
  return Array.isArray(maps) ? (maps[0] ?? null) : maps;
}

function basecampMapsDir(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Garmin", "Maps");
  }
  return join(homedir(), "AppData", "Roaming", "Garmin", "Maps");
}

async function downloadToBuffer(
  url: string,
  label: string,
  onProgress: (percent: number) => void,
): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label}: HTTP ${res.status}`);

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  let downloaded = 0;
  const chunks: Buffer[] = [];

  const reader = res.body?.getReader();
  if (!reader) throw new Error(`No response body for ${label}`);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    downloaded += value.length;
    chunks.push(Buffer.from(value));
    if (contentLength > 0) {
      onProgress(Math.round((downloaded / contentLength) * 100));
    }
  }

  return Buffer.concat(chunks);
}

async function downloadToFile(url: string, destPath: string, sender: WebContents, label: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${label}: HTTP ${res.status}`);

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
          sender.send("transfer:file-progress", {
            label,
            percent: Math.round((downloaded / contentLength) * 100),
          });
        }
        this.push(Buffer.from(value));
      }
    },
  });

  await pipeline(nodeReadable, createWriteStream(destPath));
}

async function fetchRegistrations(token: string): Promise<{ sdRegistrations: SdReg[]; digitalRegistrations: DigitalReg[] }> {
  const res = await fetch(`${BRM_API}/api/desktop/registrations`, {
    headers: { "X-Desktop-Token": token, "User-Agent": UA },
  });
  if (!res.ok) throw new Error("Could not load registration data");
  return res.json();
}

export function registerTransferHandlers(ipcMain: IpcMain): void {
  // ── Map existence check ───────────────────────────────────────────────────────
  ipcMain.handle("transfer:check", (_event, mountpoint: string) => {
    const imgPath = join(mountpoint, "Garmin", "gmapsupp.img");
    return { exists: existsSync(imgPath) };
  });

  // ── Device transfer ───────────────────────────────────────────────────────────
  ipcMain.handle("transfer:start", async (event, req: TransferRequest) => {
    const stored = getStoredToken();
    if (!stored) return { error: "Not logged in" };

    const sender = event.sender as WebContents;
    const send = (stage: string, percent: number) => sender.send("transfer:progress", { stage, percent });

    try {
      send("Fetching map data…", 0);
      const { sdRegistrations, digitalRegistrations } = await fetchRegistrations(stored.token);

      const reg = req.registrationType === "sd"
        ? sdRegistrations.find((r) => r.id === req.registrationId)
        : digitalRegistrations.find((r) => r.id === req.registrationId);

      if (!reg) return { error: "Registration not found" };

      const maps = resolveMap(reg.maps);
      if (!maps) return { error: "Map data not available" };

      // Files to transfer to the device — SD uses the SD img path, digital uses the digital path
      const imgUrl = req.registrationType === "sd"
        ? maps.pc_update_path_sd
        : maps.pc_update_path_digital;
      const poiUrl = maps.poi_update_path;
      const unlUrl = reg.unl_file_url;
      const gmaUrl = req.registrationType === "sd"
        ? (reg as SdReg).companion_file_url
        : (reg as DigitalReg).gma_file_url;

      if (!imgUrl) return { error: "Map file not available — contact support." };

      const garminDir = join(req.deviceMountpoint, "Garmin");
      const poiDir = join(garminDir, "POI");
      mkdirSync(garminDir, { recursive: true });
      if (poiUrl) mkdirSync(poiDir, { recursive: true });

      send("Downloading map file…", 5);
      await downloadToFile(imgUrl, join(garminDir, "gmapsupp.img"), sender, "Map file");

      send("Downloading license…", 60);
      if (unlUrl) await downloadToFile(unlUrl, join(garminDir, "gmapsupp.unl"), sender, "License");

      send("Downloading activation file…", 75);
      if (gmaUrl) await downloadToFile(gmaUrl, join(garminDir, `${maps.acronym ?? reg.map_number}.gma`), sender, "Activation");

      send("Downloading POI file…", 88);
      if (poiUrl) await downloadToFile(poiUrl, join(poiDir, `${maps.acronym ?? reg.map_number}.gpi`), sender, "POI");

      send("Done", 100);
      return { success: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Transfer failed" };
    }
  });

  // ── Basecamp install ──────────────────────────────────────────────────────────
  ipcMain.handle("basecamp:download", async (event, req: BasecampRequest) => {
    const sender = event.sender as WebContents;
    const send = (stage: string, percent: number) => sender.send("basecamp:progress", { stage, percent });

    try {
      const url = process.platform === "darwin" ? req.macDownloadUrl : req.pcDownloadUrl;
      if (!url) return { error: "No download URL available for your platform." };

      send("Downloading map archive…", 0);
      const zipBuf = await downloadToBuffer(url, "Map archive", (pct) => {
        send("Downloading map archive…", Math.round(pct * 0.88));
      });

      send("Extracting to Basecamp Maps…", 90);
      const destDir = basecampMapsDir();
      mkdirSync(destDir, { recursive: true });

      const zip = new AdmZip(zipBuf);
      zip.extractAllTo(destDir, true);

      const stem = req.mapAcronym ?? req.mapName.replace(/\s+/g, "_");

      if (req.gmaFileUrl) {
        send("Downloading license (.gma)…", 93);
        const gmaBuf = await downloadToBuffer(req.gmaFileUrl, "License (.gma)", () => {});
        writeFileSync(join(destDir, `${stem}.gma`), gmaBuf);
      }

      if (req.unlFileUrl) {
        send("Downloading unlock (.unl)…", 97);
        const unlBuf = await downloadToBuffer(req.unlFileUrl, "Unlock (.unl)", () => {});
        writeFileSync(join(destDir, `${stem}.unl`), unlBuf);
      }

      send("Done", 100);
      return { success: true, destDir };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Basecamp install failed" };
    }
  });
}

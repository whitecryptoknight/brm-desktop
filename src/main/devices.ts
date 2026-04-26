import { existsSync, readFileSync } from "fs";
import { join } from "path";
import si from "systeminformation";
import type { BrowserWindow, IpcMain } from "electron";
import { readImgInfo, clearImgInfoCache } from "./imginfo";
import type { ImgInfo } from "./imginfo";

export type { ImgInfo };

export interface GarminDataType {
  name: string;
  path?: string;
  direction?: string; // "InputOutput" | "Input" | "Output"
}

export interface DetectedDevice {
  mountpoint: string;
  label: string;
  type: "garmin" | "sd" | "unknown";
  isRemovable: boolean;
  // From GarminDevice.xml
  garminModel?: string;
  garminPartNumber?: string;
  garminSwVersion?: string;
  garminUnitId?: string;
  garminDisplayName?: string;
  garminUnlockCodes?: string[];
  garminDataTypes?: GarminDataType[];
  storageTotalBytes?: number;
  storageFreeBytes?: number;
  // From gmt -i
  imgInfo?: ImgInfo;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastDeviceJson = "";
let knownMountpoints = new Set<string>();

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
  return m?.[1]?.trim();
}

function extractBlock(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m?.[1];
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

// ── GarminDevice.xml parser ───────────────────────────────────────────────────

function parseGarminDeviceXml(mountpoint: string): Partial<DetectedDevice> & {
  totalBytes?: number;
  freeBytes?: number;
} {
  const candidates = [
    join(mountpoint, "Garmin", "GarminDevice.xml"),
    join(mountpoint, "GarminDevice.xml"),
  ];

  for (const xmlPath of candidates) {
    if (!existsSync(xmlPath)) continue;
    try {
      const xml = readFileSync(xmlPath, "utf8");

      const modelBlock = extractBlock(xml, "Model") ?? "";
      const garminModel = extractTag(modelBlock, "Description");
      const garminPartNumber = extractTag(modelBlock, "PartNumber");
      const garminSwVersion = extractTag(modelBlock, "SoftwareVersion");

      const garminUnitId = extractTag(xml, "Id");
      const garminDisplayName = extractTag(xml, "DisplayName");

      const unlockBlocks = extractAllBlocks(xml, "Unlock");
      const garminUnlockCodes = unlockBlocks
        .map((b) => extractTag(b, "Code"))
        .filter((c): c is string => !!c);

      const msmBlock = extractBlock(xml, "MassStorageMode") ?? "";
      const dataTypeBlocks = extractAllBlocks(msmBlock, "DataType");
      const garminDataTypes: GarminDataType[] = dataTypeBlocks
        .map((b) => ({
          name: extractTag(b, "Name") ?? "",
          path: extractTag(b, "Path"),
          direction: extractTag(b, "TransferDirection"),
        }))
        .filter((dt) => dt.name);

      const dataAreaBlock = extractBlock(msmBlock, "DataArea") ?? "";
      const totalStr = extractTag(dataAreaBlock, "TotalBytes");
      const freeStr = extractTag(dataAreaBlock, "FreeBytes");

      return {
        garminModel,
        garminPartNumber,
        garminSwVersion,
        garminUnitId,
        garminDisplayName,
        garminUnlockCodes: garminUnlockCodes.length ? garminUnlockCodes : undefined,
        garminDataTypes: garminDataTypes.length ? garminDataTypes : undefined,
        totalBytes: totalStr ? parseInt(totalStr, 10) : undefined,
        freeBytes: freeStr ? parseInt(freeStr, 10) : undefined,
      };
    } catch {
      // unreadable — try next candidate
    }
  }
  return {};
}

// ── Disk space fallback ───────────────────────────────────────────────────────

async function getDiskSpace(mountpoint: string): Promise<{ totalBytes?: number; freeBytes?: number }> {
  try {
    const sizes = await si.fsSize();
    const entry = sizes.find(
      (s) => s.mount === mountpoint || s.mount.toLowerCase() === mountpoint.toLowerCase()
    );
    if (entry) return { totalBytes: entry.size, freeBytes: entry.available };
  } catch {
    // ignore
  }
  return {};
}

// ── Device listing ────────────────────────────────────────────────────────────

async function listGarminDevices(): Promise<DetectedDevice[]> {
  const blocks = await si.blockDevices();
  const devices: DetectedDevice[] = [];

  for (const block of blocks) {
    if (!block.removable) continue;
    const mountpoint = block.mount;
    if (!mountpoint) continue;

    const label = block.label || block.name || "Removable Drive";
    const labelUpper = label.toUpperCase();
    const hasGarminFolder = existsSync(join(mountpoint, "Garmin"));

    if (labelUpper.includes("GARMIN") || hasGarminFolder) {
      const type =
        block.type?.toLowerCase().includes("sd") || labelUpper.includes("SD") ? "sd" : "garmin";

      const { totalBytes, freeBytes, ...xmlInfo } = parseGarminDeviceXml(mountpoint);
      const space =
        totalBytes !== undefined
          ? { totalBytes, freeBytes }
          : await getDiskSpace(mountpoint);

      const imgInfo = await readImgInfo(mountpoint);

      devices.push({
        mountpoint,
        label,
        type,
        isRemovable: true,
        ...xmlInfo,
        storageTotalBytes: space.totalBytes,
        storageFreeBytes: space.freeBytes,
        imgInfo,
      });
    } else {
      devices.push({ mountpoint, label, type: "unknown", isRemovable: true });
    }
  }

  return devices;
}

// ── Polling + IPC ─────────────────────────────────────────────────────────────

export function startDevicePolling(win: BrowserWindow): void {
  pollInterval = setInterval(async () => {
    try {
      const devices = await listGarminDevices();

      // Clear imgInfo cache for mountpoints that disappeared (e.g. card swap)
      const current = new Set(devices.map((d) => d.mountpoint));
      for (const mp of knownMountpoints) {
        if (!current.has(mp)) clearImgInfoCache(mp);
      }
      knownMountpoints = current;

      const json = JSON.stringify(devices);
      if (json !== lastDeviceJson) {
        lastDeviceJson = json;
        win.webContents.send("devices:changed", devices);
      }
    } catch {
      // ignore transient errors
    }
  }, 3000);
}

export function stopDevicePolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

export function registerDeviceHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("devices:list", () => listGarminDevices());
}

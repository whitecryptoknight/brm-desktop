import { existsSync } from "fs";
import { join } from "path";
import si from "systeminformation";
import type { BrowserWindow, IpcMain } from "electron";

export interface DetectedDevice {
  mountpoint: string;
  label: string;
  type: "garmin" | "sd" | "unknown";
  isRemovable: boolean;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;
let lastDeviceJson = "";

async function listGarminDevices(): Promise<DetectedDevice[]> {
  const blocks = await si.blockDevices();
  const devices: DetectedDevice[] = [];

  for (const block of blocks) {
    // Only removable drives (USB flash, SD cards)
    if (!block.removable) continue;
    const mountpoint = block.mount;
    if (!mountpoint) continue;

    const label = block.label || block.name || "Removable Drive";
    const labelUpper = label.toUpperCase();
    const hasGarminFolder = existsSync(join(mountpoint, "Garmin"));

    if (labelUpper.includes("GARMIN") || hasGarminFolder) {
      const type = block.type?.toLowerCase().includes("sd") || labelUpper.includes("SD") ? "sd" : "garmin";
      devices.push({ mountpoint, label, type, isRemovable: true });
    } else {
      devices.push({ mountpoint, label, type: "unknown", isRemovable: true });
    }
  }

  return devices;
}

export function startDevicePolling(win: BrowserWindow): void {
  pollInterval = setInterval(async () => {
    try {
      const devices = await listGarminDevices();
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

import { contextBridge, ipcRenderer } from "electron";
import type { DetectedDevice } from "../main/devices";

contextBridge.exposeInMainWorld("brm", {
  // Auth
  verifyToken: (token: string) => ipcRenderer.invoke("auth:verify-token", token),
  logout: () => ipcRenderer.invoke("auth:logout"),
  checkAuth: () => ipcRenderer.invoke("auth:check"),
  getToken: () => ipcRenderer.invoke("auth:get-token"),

  // Devices
  listDevices: () => ipcRenderer.invoke("devices:list"),
  onDevicesChanged: (cb: (devices: DetectedDevice[]) => void) => {
    ipcRenderer.on("devices:changed", (_e, devices) => cb(devices));
    return () => ipcRenderer.removeAllListeners("devices:changed");
  },

  // Device transfer
  checkDeviceMap: (mountpoint: string) =>
    ipcRenderer.invoke("transfer:check", mountpoint),
  startTransfer: (req: { registrationId: number; registrationType: "sd" | "digital"; deviceMountpoint: string }) =>
    ipcRenderer.invoke("transfer:start", req),
  onTransferProgress: (cb: (data: { stage: string; percent: number }) => void) => {
    ipcRenderer.on("transfer:progress", (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("transfer:progress");
  },
  onFileProgress: (cb: (data: { label: string; percent: number }) => void) => {
    ipcRenderer.on("transfer:file-progress", (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("transfer:file-progress");
  },

  // Basecamp install
  downloadBasecamp: (req: { pcDownloadUrl: string; macDownloadUrl: string; mapName: string; mapAcronym?: string; gmaFileUrl?: string; unlFileUrl?: string }) =>
    ipcRenderer.invoke("basecamp:download", req),
  onBasecampProgress: (cb: (data: { stage: string; percent: number }) => void) => {
    ipcRenderer.on("basecamp:progress", (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("basecamp:progress");
  },
});

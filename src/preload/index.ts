import { contextBridge, ipcRenderer } from "electron";
import type { DetectedDevice } from "../main/devices";

contextBridge.exposeInMainWorld("brm", {
  // Auth
  login: (email: string, password: string) =>
    ipcRenderer.invoke("auth:login", { email, password }),
  logout: () => ipcRenderer.invoke("auth:logout"),
  checkAuth: () => ipcRenderer.invoke("auth:check"),

  // Devices
  listDevices: () => ipcRenderer.invoke("devices:list"),
  onDevicesChanged: (cb: (devices: DetectedDevice[]) => void) => {
    ipcRenderer.on("devices:changed", (_e, devices) => cb(devices));
    return () => ipcRenderer.removeAllListeners("devices:changed");
  },

  // Transfer
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
});

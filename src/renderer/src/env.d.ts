/// <reference types="vite/client" />

import type { DetectedDevice } from "../../main/devices";

interface Window {
  brm: {
    // Auth
    verifyToken(token: string): Promise<{ customerId?: string; error?: string }>;
    logout(): Promise<void>;
    checkAuth(): Promise<{ customerId: string } | null>;
    getToken(): Promise<string | null>;

    // Devices
    listDevices(): Promise<DetectedDevice[]>;
    onDevicesChanged(cb: (devices: DetectedDevice[]) => void): () => void;

    // Device transfer
    checkDeviceMap(mountpoint: string): Promise<{ exists: boolean }>;
    startTransfer(req: { registrationId: number; registrationType: "sd" | "digital"; deviceMountpoint: string }): Promise<{ success?: boolean; error?: string }>;
    onTransferProgress(cb: (data: { stage: string; percent: number }) => void): () => void;
    onFileProgress(cb: (data: { label: string; percent: number }) => void): () => void;

    // Basecamp install
    downloadBasecamp(req: { pcDownloadUrl: string; macDownloadUrl: string; mapName: string; mapAcronym?: string; gmaFileUrl?: string; unlFileUrl?: string }): Promise<{ success?: boolean; destDir?: string; error?: string }>;
    onBasecampProgress(cb: (data: { stage: string; percent: number }) => void): () => void;
  };
}

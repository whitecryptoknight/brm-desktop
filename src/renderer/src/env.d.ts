/// <reference types="vite/client" />

import type { DetectedDevice } from "../../main/devices";

interface Window {
  brm: {
    login(email: string, password: string): Promise<{ customerId?: string; expiresAt?: string; error?: string }>;
    logout(): Promise<void>;
    checkAuth(): Promise<{ customerId: string } | null>;

    listDevices(): Promise<DetectedDevice[]>;
    onDevicesChanged(cb: (devices: DetectedDevice[]) => void): () => void;

    startTransfer(req: { registrationId: number; registrationType: "sd" | "digital"; deviceMountpoint: string }): Promise<{ success?: boolean; error?: string }>;
    onTransferProgress(cb: (data: { stage: string; percent: number }) => void): () => void;
    onFileProgress(cb: (data: { label: string; percent: number }) => void): () => void;
  };
}

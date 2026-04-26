import { safeStorage } from "electron";
import type { IpcMain } from "electron";

const BRM_API = process.env.BRM_API_URL ?? "https://dev.brmb.support";

const _store: { encryptedToken?: string; customerId?: string } = {};

function saveToken(token: string, customerId: string): void {
  _store.encryptedToken = safeStorage.encryptString(token).toString("base64");
  _store.customerId = customerId;
}

export function getStoredToken(): { token: string; customerId: string } | null {
  if (!_store.encryptedToken || !_store.customerId) return null;
  try {
    const token = safeStorage.decryptString(Buffer.from(_store.encryptedToken, "base64"));
    return { token, customerId: _store.customerId };
  } catch {
    return null;
  }
}

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("auth:verify-token", async (_event, desktopToken: string) => {
    try {
      const res = await fetch(`${BRM_API}/api/desktop/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: desktopToken }),
      });
      const body = await res.json() as { customerId?: string; error?: string };
      if (!res.ok || !body.customerId) {
        return { error: body.error ?? "Invalid token" };
      }
      saveToken(desktopToken, body.customerId);
      return { customerId: body.customerId };
    } catch (e) {
      return { error: `Could not reach BRM server: ${e instanceof Error ? e.message : e}` };
    }
  });

  ipcMain.handle("auth:logout", () => {
    _store.encryptedToken = undefined;
    _store.customerId = undefined;
  });

  ipcMain.handle("auth:check", () => {
    const stored = getStoredToken();
    return stored ? { customerId: stored.customerId } : null;
  });

  ipcMain.handle("auth:get-token", () => {
    return getStoredToken()?.token ?? null;
  });
}

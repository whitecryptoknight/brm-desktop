import { safeStorage } from "electron";
import type { IpcMain } from "electron";

const TOKEN_KEY = "brm-access-token";
const CUSTOMER_KEY = "brm-customer-id";

const BRM_API = process.env.BRM_API_URL ?? "https://dev.brmb.support";

// Encrypted token storage using Electron's OS keychain wrapper
function saveToken(token: string, customerId: string): void {
  const store = getTokenStore();
  store.token = safeStorage.encryptString(token).toString("base64");
  store.customerId = customerId;
  process.env[TOKEN_KEY] = store.token;
  process.env[CUSTOMER_KEY] = customerId;
}

const _store: { token?: string; customerId?: string } = {};
function getTokenStore() { return _store; }

export function getStoredToken(): { token: string; customerId: string } | null {
  const store = getTokenStore();
  if (!store.token || !store.customerId) return null;
  try {
    const token = safeStorage.decryptString(Buffer.from(store.token, "base64"));
    return { token, customerId: store.customerId };
  } catch {
    return null;
  }
}

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("auth:login", async (_e, { email, password }: { email: string; password: string }) => {
    const res = await fetch(`${BRM_API}/api/desktop/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json() as { accessToken?: string; customerId?: string; expiresAt?: string; error?: string };

    if (!res.ok || !data.accessToken) {
      return { error: data.error ?? "Login failed" };
    }

    saveToken(data.accessToken, data.customerId ?? "");
    return { customerId: data.customerId, expiresAt: data.expiresAt };
  });

  ipcMain.handle("auth:logout", () => {
    _store.token = undefined;
    _store.customerId = undefined;
  });

  ipcMain.handle("auth:check", () => {
    const stored = getStoredToken();
    return stored ? { customerId: stored.customerId } : null;
  });
}

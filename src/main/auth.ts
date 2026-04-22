import { safeStorage, shell } from "electron";
import { randomBytes, createHash } from "crypto";
import type { IpcMain } from "electron";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN ?? "backroadmapbooks.myshopify.com";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const REDIRECT_URI = "brm-map-loader://auth";

// ── PKCE helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

// ── OpenID discovery ─────────────────────────────────────────────────────────

async function discoverEndpoints(): Promise<{ authorizationEndpoint: string; tokenEndpoint: string }> {
  const res = await fetch(`https://${SHOP_DOMAIN}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error("Could not reach Shopify OpenID configuration");
  const config = await res.json() as { authorization_endpoint: string; token_endpoint: string };
  return {
    authorizationEndpoint: config.authorization_endpoint,
    tokenEndpoint: config.token_endpoint,
  };
}

// ── Pending protocol callback ─────────────────────────────────────────────────

let pendingResolve: ((url: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

export function handleProtocolUrl(url: string): void {
  if (pendingResolve) {
    pendingResolve(url);
    pendingResolve = null;
    pendingReject = null;
  }
}

function waitForCallback(timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResolve = null;
      pendingReject = null;
      reject(new Error("Sign-in timed out. Please try again."));
    }, timeoutMs);

    pendingResolve = (url) => { clearTimeout(timer); resolve(url); };
    pendingReject = (err) => { clearTimeout(timer); reject(err); };
  });
}

// ── Token storage ─────────────────────────────────────────────────────────────

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

// ── IPC handlers ─────────────────────────────────────────────────────────────

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("auth:start-login", async () => {
    if (!CLIENT_ID) return { error: "SHOPIFY_CLIENT_ID is not configured" };

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString("hex");
    const nonce = randomBytes(16).toString("hex");

    let authorizationEndpoint: string;
    let tokenEndpoint: string;
    try {
      ({ authorizationEndpoint, tokenEndpoint } = await discoverEndpoints());
    } catch (e) {
      return { error: `Could not reach Shopify: ${e instanceof Error ? e.message : e}` };
    }

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email customer-account-api:full");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    shell.openExternal(authUrl.toString());

    let callbackUrl: string;
    try {
      callbackUrl = await waitForCallback();
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Authentication failed" };
    }

    const params = new URL(callbackUrl).searchParams;
    const returnedState = params.get("state");
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) return { error: `Shopify error: ${params.get("error_description") ?? errorParam}` };
    if (returnedState !== state) return { error: "Invalid state — possible CSRF. Please try again." };
    if (!code) return { error: "No authorization code received" };

    // Exchange code for tokens
    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => "");
      return { error: `Token exchange failed (${tokenRes.status}): ${text.slice(0, 100)}` };
    }

    const tokens = await tokenRes.json() as {
      access_token?: string;
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokens.access_token) {
      return { error: tokens.error_description ?? tokens.error ?? "No access token returned" };
    }

    // Extract customer ID from id_token (JWT sub claim = GID)
    let customerId = "";
    if (tokens.id_token) {
      try {
        const payload = decodeJwtPayload(tokens.id_token);
        const gid = (payload.sub as string) ?? "";
        customerId = gid.replace("gid://shopify/Customer/", "");
      } catch {
        // fall through — customerId stays empty
      }
    }

    saveToken(tokens.access_token, customerId);
    return { customerId };
  });

  ipcMain.handle("auth:logout", () => {
    _store.encryptedToken = undefined;
    _store.customerId = undefined;
  });

  ipcMain.handle("auth:check", () => {
    const stored = getStoredToken();
    return stored ? { customerId: stored.customerId } : null;
  });
}

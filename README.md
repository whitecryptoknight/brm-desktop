# BRM Map Loader

Desktop app for transferring BackroadMapBooks GPS maps to Garmin devices, SD cards, and Garmin BaseCamp. Sign in with a desktop token from your BackroadMapBooks account, see your registered maps, plug in your GPS unit or SD card, and load maps directly — no manual file management required.

Built with Electron + React + TypeScript.

---

## What it does

- Authenticates with your BackroadMapBooks account via a desktop access token
- Lists all your registered SD and digital maps
- Detects connected Garmin GPS units and SD cards (USB mass storage mode)
- Reads installed map info from the device (`gmt -i` on `gmapsupp.img`) — shows map name, version, Family ID, and unlock codes
- Downloads map files + license files from the server and writes them to the correct location on the device:

```
{device}/
└── Garmin/
    ├── gmapsupp.img    ← map data
    ├── gmapsupp.unl    ← unlock license
    ├── {acronym}.gma   ← activation file
    └── POI/
        └── {acronym}.gpi   ← points of interest
```

- Installs maps directly into **Garmin BaseCamp** (extracts ZIP archive to the platform Maps folder):
  - Mac: `~/Library/Application Support/Garmin/Maps/`
  - Windows: `%APPDATA%\Garmin\Maps\`

> **Note:** Your Garmin GPS must be in **USB Mass Storage mode** (not MTP). On most units: Settings → System → USB Mode → Mass Storage.

---

## Requirements

- Node.js 20+
- npm 9+
- The BRM Remix API must be deployed and have the Customer Account API env vars configured (see [API Setup](#api-setup) below)

---

## Authentication

Login uses a **desktop access token** — a long-lived token generated from the customer portal:

1. Customer visits the BRM portal → Account → GPS Maps → Desktop App → **Generate Desktop Token**
2. Paste the token into the app's login screen
3. The app sends `POST /api/desktop/auth` to verify the token with the BRM API, which returns the Shopify Customer ID
4. The token is encrypted at rest using `safeStorage` (OS keychain on Mac, DPAPI on Windows)

---

## Environment variables

Create a `.env` file in the project root:

```
VITE_BRM_API_URL=https://your-deployed-api.vercel.app
VITE_SHOPIFY_STORE_DOMAIN=backroadmapbooks.myshopify.com
VITE_SHOPIFY_CLIENT_ID=<Customer Account API client ID>
```

For development against a local API tunnel:

```
VITE_BRM_API_URL=https://your-cloudflare-tunnel.trycloudflare.com
VITE_SHOPIFY_STORE_DOMAIN=backwoods-8728.myshopify.com
VITE_SHOPIFY_CLIENT_ID=<dev store client ID>
```

---

## API Setup

The desktop app communicates with the BRM Remix API using an `X-Desktop-Token` header. The API needs these env vars:

```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_APP_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GCLOUD_BUCKET_NAME
GCLOUD_SERVICE_ACCOUNT_JSON
```

Desktop token endpoints required on the API:

| Route | Purpose |
|-------|---------|
| `POST /api/desktop/auth` | Verify a desktop token, return `customerId` |
| `GET /api/desktop/registrations` | Return SD + digital registrations for the token holder |
| `POST /api/desktop/apply-update-sd` | Apply an SD map update credit |
| `POST /api/desktop/apply-update-digital` | Apply a digital map update credit |

All desktop routes accept `X-Desktop-Token: <token>` and reject requests without a valid token.

---

## Bundled binaries

Map info is read from `gmapsupp.img` using **gmt** (Garmin Map Tool, v0.9.x, CC BY-SA):

```
resources/
└── bin/
    ├── win/
    │   └── gmt.exe     ← Windows
    └── mac/
        └── gmt         ← macOS (chmod 755 applied automatically at runtime)
```

These are copied into the packaged app via the `extraResources` field in `package.json`. The Mac binary is made executable at first use by the main process.

---

## Development

```bash
npm install
npm run dev
```

This opens the app in Electron with hot module reload. Changes to renderer code update instantly; changes to main-process files require a restart.

---

## Building

### Windows

Run on a Windows machine:

```bash
npm run build:win
```

Output: `dist/BRM Map Loader Setup.exe` (NSIS installer)

### Mac

Mac builds **must be compiled on macOS** due to symlink requirements in the macOS code-signing toolchain. They cannot be cross-compiled from Windows.

**Option 1 — Build locally on a Mac:**

```bash
npm install
npm run build:mac
```

Output: `dist/BRM Map Loader.dmg`

**Option 2 — Build via GitHub Actions (recommended):**

Push a version tag to trigger the CI workflow, which builds both `.exe` and `.dmg` in parallel:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow (`.github/workflows/build.yml`) runs on `windows-latest` and `macos-latest` runners and uploads both installers as artifacts. Set `BRM_API_URL` as a repository secret in GitHub → Settings → Secrets and variables → Actions.

---

## Project structure

```
src/
├── main/
│   ├── index.ts       # Electron app entry, window setup, CORS injection, IPC registration
│   ├── auth.ts        # Desktop token verification via BRM API; encrypted with safeStorage
│   ├── devices.ts     # Polls removable drives every 3s; parses GarminDevice.xml + gmt imginfo
│   ├── imginfo.ts     # Reads gmapsupp.img via gmt -i; cross-platform; cached per mountpoint
│   └── transfer.ts    # Device transfer (SD/digital) + BaseCamp ZIP install
├── preload/
│   └── index.ts       # Exposes brm.* API to renderer via contextBridge
└── renderer/src/
    ├── App.tsx
    ├── screens/
    │   ├── Login.tsx      # Desktop token paste form
    │   ├── Dashboard.tsx  # Map list + device sidebar with map info chips
    │   └── Transfer.tsx   # Device picker, progress bar, confirmation
    └── env.d.ts           # window.brm type declarations
```

---

## Tech stack

| | |
|---|---|
| Framework | Electron 31 |
| Build | electron-vite + Vite 5 |
| UI | React 18 + Tailwind CSS |
| Device detection | systeminformation (pure JS, no native deps) |
| Map info | gmt (Garmin Map Tool, bundled binary) |
| ZIP extraction | adm-zip |
| Packaging | electron-builder |
| Auth | Desktop access token verified against BRM API |
| Token storage | Electron safeStorage (OS keychain on Mac, DPAPI on Windows) |

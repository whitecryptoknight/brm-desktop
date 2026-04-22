# BRM Map Loader

Desktop app for transferring BackroadMapBooks GPS maps to Garmin devices and SD cards. Sign in with your BackroadMapBooks account, see your registered maps, plug in your GPS unit or SD card, and load maps directly — no manual file management required.

Built with Electron + React + TypeScript.

---

## What it does

- Authenticates with your BackroadMapBooks / Shopify account
- Lists all your registered SD and digital maps
- Detects connected Garmin GPS units and SD cards (USB mass storage mode)
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

> **Note:** Your Garmin GPS must be in **USB Mass Storage mode** (not MTP). On most units: Settings → System → USB Mode → Mass Storage.

---

## Requirements

- Node.js 20+
- npm 9+
- The BRM Remix API must be deployed and have the Storefront API env vars set (see [API Setup](#api-setup) below)

---

## Environment variables

Create a `.env` file in the project root:

```
VITE_BRM_API_URL=https://your-deployed-api.vercel.app
```

For development against a local API tunnel:

```
VITE_BRM_API_URL=https://your-cloudflare-tunnel.trycloudflare.com
```

---

## API Setup

The desktop app authenticates via the Shopify Storefront API. The BRM Remix API needs two additional env vars:

```
SHOPIFY_STORE_DOMAIN=backroadmapbooks.myshopify.com
SHOPIFY_STOREFRONT_PUBLIC_TOKEN=<token>
```

To get the Storefront public token:
1. Shopify Admin → Settings → Apps and sales channels → Develop apps
2. Open your app → Storefront API access tab
3. Enable the `unauthenticated_read_customers` scope and copy the Storefront API access token

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
│   ├── index.ts       # Electron app entry, window setup, IPC registration
│   ├── auth.ts        # Login via BRM API; token stored with safeStorage (OS keychain)
│   ├── devices.ts     # Polls for removable drives every 3s via systeminformation
│   └── transfer.ts    # Downloads map + license files, writes to Garmin/ folder
├── preload/
│   └── index.ts       # Exposes brm.* API to renderer via contextBridge
└── renderer/src/
    ├── App.tsx
    ├── screens/
    │   ├── Login.tsx      # Email/password form
    │   ├── Dashboard.tsx  # Map list + device sidebar
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
| Packaging | electron-builder |
| Auth | Shopify Storefront API (customerAccessTokenCreate) |
| Token storage | Electron safeStorage (OS keychain on Mac, DPAPI on Windows) |

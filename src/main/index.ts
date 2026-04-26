import { app, BrowserWindow, ipcMain, shell, session } from "electron";
import { join } from "path";
import { registerAuthHandlers } from "./auth";
import { registerDeviceHandlers, startDevicePolling, stopDevicePolling } from "./devices";
import { registerTransferHandlers } from "./transfer";

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 580,
    title: "BRM Map Loader",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  startDevicePolling(win);
}

app.whenReady().then(() => {
  // Inject CORS headers into all BRM API responses so the renderer can fetch
  // cross-origin without being blocked by Chromium's CORS enforcement.
  // Inject CORS headers into all responses so the renderer can fetch cross-origin.
  // This fires on OPTIONS preflight responses too, which is enough provided the
  // Remix server returns any HTTP response to OPTIONS (even 200 from the CORS handler).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "access-control-allow-origin": ["*"],
        "access-control-allow-headers": ["X-Desktop-Token, Content-Type, Authorization"],
        "access-control-allow-methods": ["GET, POST, OPTIONS"],
        "access-control-max-age": ["86400"],
      },
    });
  });

  registerAuthHandlers(ipcMain);
  registerDeviceHandlers(ipcMain);
  registerTransferHandlers(ipcMain);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopDevicePolling();
  if (process.platform !== "darwin") app.quit();
});

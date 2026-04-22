import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";
import { registerAuthHandlers, handleProtocolUrl } from "./auth";
import { registerDeviceHandlers, startDevicePolling, stopDevicePolling } from "./devices";
import { registerTransferHandlers } from "./transfer";

// Register as handler for brm-map-loader:// URLs (must be before app.whenReady)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("brm-map-loader", process.execPath, [process.argv[1]]);
  }
} else {
  app.setAsDefaultProtocolClient("brm-map-loader");
}

// Windows: app is re-launched with the URL as an argument
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const url = argv.find((arg) => arg.startsWith("brm-map-loader://"));
    if (url) handleProtocolUrl(url);
  });
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
  registerAuthHandlers(ipcMain);
  registerDeviceHandlers(ipcMain);
  registerTransferHandlers(ipcMain);
  createWindow();

  // Mac: handle protocol URL when app is already open
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopDevicePolling();
  if (process.platform !== "darwin") app.quit();
});

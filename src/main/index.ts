import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";
import { registerAuthHandlers } from "./auth";
import { registerDeviceHandlers, startDevicePolling, stopDevicePolling } from "./devices";
import { registerTransferHandlers } from "./transfer";

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

  // Open external links in the system browser
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopDevicePolling();
  if (process.platform !== "darwin") app.quit();
});

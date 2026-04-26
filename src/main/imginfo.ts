import { existsSync, chmodSync } from "fs";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { app } from "electron";

const execFileAsync = promisify(execFile);

export interface ImgInfo {
  fileSize?: string;
  version?: string;
  mapName?: string;
  filePath?: string;
  familyId?: string;
  routable?: string;
  unlockCodes?: string[];
}

function getExePath(): string {
  const isWin = process.platform === "win32";
  const rel = isWin ? join("bin", "win", "gmt.exe") : join("bin", "mac", "gmt");
  if (app.isPackaged) {
    return join(process.resourcesPath, rel);
  }
  return join(app.getAppPath(), "resources", rel);
}

function ensureExecutable(exePath: string): void {
  if (process.platform !== "win32") {
    try { chmodSync(exePath, 0o755); } catch { /* ignore */ }
  }
}

function parseOutput(stdout: string): ImgInfo {
  const result: ImgInfo = {};
  const codes: string[] = [];

  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // File:   /path/to/gmapsupp.img, length 1234567
    const fileMatch = line.match(/^File:\s+(.+),\s+length\s+(\d+)/i);
    if (fileMatch) {
      result.filePath = fileMatch[1].trim();
      result.fileSize = fileMatch[2];
      continue;
    }

    // Header:   ..., V 14.00, ...
    const verMatch = line.match(/\bV\s+([\d.]+)\b/);
    if (verMatch && line.match(/^Header:/i)) {
      result.version = verMatch[1];
      continue;
    }

    // Mapset:   Backroad GPS Maps BC 2025
    const mapsetMatch = line.match(/^Mapset:\s+(.+)/i);
    if (mapsetMatch) {
      result.mapName = mapsetMatch[1].trim();
      continue;
    }

    // " F: PID 1, FID 4836, ..."  (inside Data MPS block)
    const fidMatch = line.match(/\bFID\s+(\d+)\b/);
    if (fidMatch && line.match(/^\s*F:/)) {
      result.familyId = fidMatch[1];
      continue;
    }

    // " U: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
    const unlockMatch = line.match(/^\s*U:\s+(.+)/);
    if (unlockMatch) {
      const code = unlockMatch[1].trim();
      // skip placeholder all-zero codes
      if (!/^[0\-]+$/.test(code)) {
        codes.push(code);
      }
      continue;
    }
  }

  if (codes.length) result.unlockCodes = codes;
  return result;
}

// ── Cache — keyed by mountpoint, cleared when device disconnects ──────────────

const cache = new Map<string, ImgInfo>();

export function clearImgInfoCache(mountpoint: string): void {
  cache.delete(mountpoint);
}

export async function readImgInfo(mountpoint: string): Promise<ImgInfo | undefined> {
  const imgPath = join(mountpoint, "Garmin", "gmapsupp.img");
  if (!existsSync(imgPath)) return undefined;

  if (cache.has(mountpoint)) return cache.get(mountpoint);

  const exePath = getExePath();
  if (!existsSync(exePath)) return undefined;

  ensureExecutable(exePath);

  try {
    const { stdout } = await execFileAsync(
      exePath,
      ["-LicenseAcknowledge", "-i", imgPath],
      { timeout: 10_000 }
    );
    const info = parseOutput(stdout);
    cache.set(mountpoint, info);
    return info;
  } catch {
    return undefined;
  }
}

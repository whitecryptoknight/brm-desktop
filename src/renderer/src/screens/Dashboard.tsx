import { useEffect, useState, useCallback } from "react";
import type { DetectedDevice, ImgInfo } from "../../../main/devices";
import Transfer from "./Transfer";
import logoUrl from "../assets/Backroad-Maps-Horizontal-Logo.avif";
import sidebarBgUrl from "../assets/SideBG.jpg";

const BRM_API = import.meta.env.VITE_BRM_API_URL ?? "https://dev.brmb.support";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

function formatSwVersion(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  return `v${(n / 100).toFixed(2)}`;
}

function directionSymbol(dir?: string): string {
  if (!dir) return "";
  const d = dir.toLowerCase();
  if (d === "inputoutput") return " ↔";
  if (d === "input") return " ↓";
  if (d === "output") return " ↑";
  return "";
}

// ── Chip primitives ───────────────────────────────────────────────────────────

function Chip({ children, color = "default", title }: {
  children: React.ReactNode;
  color?: "default" | "sky" | "emerald" | "violet" | "amber" | "rose";
  title?: string;
}) {
  const palette: Record<string, string> = {
    default: "bg-white/10 text-white/55",
    sky:     "bg-sky-500/20 text-sky-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    violet:  "bg-violet-500/20 text-violet-300",
    amber:   "bg-brm-amber-500/20 text-brm-amber-300",
    rose:    "bg-rose-500/20 text-rose-300",
  };
  return (
    <span
      title={title}
      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded leading-none ${palette[color]}`}
    >
      {children}
    </span>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, tooltip, labelWidth = "w-[52px]" }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tooltip: string;
  labelWidth?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5 text-[10px]" title={tooltip}>
      <span className="text-white/35 shrink-0 mt-px">{icon}</span>
      <span className={`text-white/35 shrink-0 ${labelWidth} leading-tight`}>{label}</span>
      <span className="text-white/70 leading-tight break-all">{value}</span>
    </div>
  );
}

// ── Shared SVG icons ──────────────────────────────────────────────────────────

const IconSatellite = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const IconSdCard = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <path d="M8 2v4h8V2"/>
  </svg>
);

const IconPlug = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2v4M10 2v4"/>
    <path d="M8 6h8v4a4 4 0 01-8 0V6z"/>
    <path d="M12 14v6M9 20h6"/>
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5"
    className={`shrink-0 text-white/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
  >
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── GpsCard ───────────────────────────────────────────────────────────────────

function GpsCard({ device: d, expanded, onToggle }: {
  device: DetectedDevice;
  expanded: boolean;
  onToggle: () => void;
}) {
  const storagePct = d.storageTotalBytes && d.storageTotalBytes > 0
    ? Math.round(((d.storageTotalBytes - (d.storageFreeBytes ?? 0)) / d.storageTotalBytes) * 100)
    : 0;
  const gpiType = d.garminDataTypes?.find(dt => dt.name.toLowerCase().includes("gpi"));
  const img = d.imgInfo && Object.keys(d.imgInfo).length > 0 ? d.imgInfo : null;
  const imgFileName = img?.filePath ? img.filePath.split(/[\\/]/).pop() : undefined;
  const imgFileSize = img?.fileSize ? formatBytes(parseInt(img.fileSize, 10)) : undefined;
  const allUnlockCodes = Array.from(new Set([
    ...(d.garminUnlockCodes ?? []),
    ...(img?.unlockCodes ?? []),
  ]));

  return (
    <li>
      <div className="border border-orange-500/35 rounded-lg overflow-hidden">
        {/* Accordion header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-white/5 hover:bg-white/[0.08] transition-colors text-left"
        >
          <span className="text-brm-amber-400 shrink-0">{IconSatellite}</span>
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">GPS Unit</span>
          <span className="flex-1 text-[10px] text-white/45 truncate ml-1">{d.garminModel ?? d.label}</span>
          <IconChevron open={expanded} />
        </button>

        {/* Accordion body */}
        {expanded && (
          <div className="px-2.5 pt-2 pb-2.5 space-y-1.5 border-t border-orange-500/20 bg-white/[0.02]">

            <InfoRow
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
              label="Model"
              value={d.garminModel ?? d.label}
              tooltip="Device model name from GarminDevice.xml"
            />

            <InfoRow
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}
              label="Unit ID"
              value={d.garminUnitId}
              tooltip="Garmin device unit ID used for map license generation"
            />

            <InfoRow
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
              label="Part No."
              value={d.garminPartNumber}
              tooltip="Garmin part number identifying the device hardware revision"
            />

            <InfoRow
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>}
              label="Firmware"
              value={d.garminSwVersion ? formatSwVersion(d.garminSwVersion) : undefined}
              tooltip="Device firmware version from GarminDevice.xml"
            />

            {/* Storage */}
            {d.storageTotalBytes !== undefined && d.storageFreeBytes !== undefined && (
              <div className="pt-1 border-t border-white/8 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-white/35 shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/></svg>
                  </span>
                  <span className="text-white/35 shrink-0 w-[52px]">Storage</span>
                  <span className="text-white/70">{formatBytes(d.storageFreeBytes)} free</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1">
                  <div className="bg-brm-amber-500 h-1 rounded-full transition-all duration-300" style={{ width: `${storagePct}%` }} />
                </div>
                <p className="text-[10px] text-white/35 pl-[62px]">of {formatBytes(d.storageTotalBytes)}</p>
              </div>
            )}

            {/* Installed Maps */}
            {img && (
              <div className="pt-1 border-t border-orange-500/20 space-y-1.5">
                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Installed Maps</p>
                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>}
                  label="Map"
                  value={img.mapName}
                  tooltip="Name of the installed Garmin map"
                />
                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
                  label="Version"
                  value={img.version ? `v${img.version}` : undefined}
                  tooltip="Map version from img file header"
                />
                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}
                  label="Family ID"
                  value={img.familyId}
                  tooltip="Garmin internal map family identifier"
                />
                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  label="File"
                  value={imgFileSize ? `${imgFileSize}${imgFileName ? ` · ${imgFileName}` : ""}` : imgFileName}
                  tooltip={`gmapsupp.img: ${img.filePath ?? "unknown"}`}
                />
              </div>
            )}

            {/* GPI */}
            {gpiType && (
              <InfoRow
                icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                label="GPI"
                value="Supported"
                tooltip="Device supports Points of Interest (.gpi) files"
              />
            )}

            {/* File Types */}
            {d.garminDataTypes && d.garminDataTypes.length > 0 && (
              <div className="pt-1 border-t border-white/8 space-y-1">
                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">File Types</p>
                <div className="flex flex-wrap gap-1">
                  {d.garminDataTypes.map((dt, i) => (
                    <Chip key={i} color="default" title={dt.path ?? dt.name}>
                      {dt.name}{directionSymbol(dt.direction)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Unlock Keys */}
            {allUnlockCodes.length > 0 && (
              <div className="pt-1 border-t border-orange-500/20 space-y-1">
                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Unlock Keys</p>
                {allUnlockCodes.map((code, i) => (
                  <InfoRow
                    key={i}
                    icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
                    label={`Key ${i + 1}`}
                    value={code}
                    tooltip={`Garmin unlock code ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ── SdCard ────────────────────────────────────────────────────────────────────

function SdCard({ device: d, expanded, onToggle }: {
  device: DetectedDevice;
  expanded: boolean;
  onToggle: () => void;
}) {
  const img = d.imgInfo && Object.keys(d.imgInfo).length > 0 ? d.imgInfo : null;
  const fileName = img?.filePath ? img.filePath.split(/[\\/]/).pop() : undefined;
  const gpiType = d.garminDataTypes?.find(dt => dt.name.toLowerCase().includes("gpi"));
  const allUnlockCodes = Array.from(new Set([
    ...(d.garminUnlockCodes ?? []),
    ...(img?.unlockCodes ?? []),
  ]));

  return (
    <li>
      <div className="border border-orange-500/35 rounded-lg overflow-hidden">
        {/* Accordion header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 bg-white/5 hover:bg-white/[0.08] transition-colors text-left"
        >
          <span className="text-brm-amber-400 shrink-0">{IconSdCard}</span>
          <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">SD Card</span>
          <span className="flex-1 text-[10px] text-white/45 truncate ml-1">{d.label}</span>
          <IconChevron open={expanded} />
        </button>

        {/* Accordion body */}
        {expanded && (
          <div className="px-2.5 pt-2 pb-2.5 space-y-1.5 border-t border-orange-500/20 bg-white/[0.02]">

            <InfoRow
              icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 2v4h8V2"/></svg>}
              label="Card Label"
              value={d.label}
              tooltip="Volume label of the SD card"
              labelWidth="w-[64px]"
            />

            {/* Installed Map */}
            {img ? (
              <div className="pt-1 border-t border-orange-500/20 space-y-1.5">
                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider">Installed Map</p>

                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>}
                  label="Map"
                  value={img.mapName}
                  tooltip="Name of the installed Garmin map"
                  labelWidth="w-[64px]"
                />

                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
                  label="Map Version"
                  value={img.version ? `v${img.version}` : undefined}
                  tooltip="Map version from img file header"
                  labelWidth="w-[64px]"
                />

                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}
                  label="Family ID"
                  value={img.familyId}
                  tooltip="Garmin internal map family identifier"
                  labelWidth="w-[64px]"
                />

                <InfoRow
                  icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  label="File"
                  value={fileName}
                  tooltip={`gmapsupp.img path: ${img.filePath ?? "unknown"}`}
                  labelWidth="w-[64px]"
                />

                {gpiType && (
                  <InfoRow
                    icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                    label="GPI"
                    value="Supported"
                    tooltip="Device supports Points of Interest (.gpi) files"
                    labelWidth="w-[64px]"
                  />
                )}

                {allUnlockCodes.length > 0 && (
                  <div className="pt-1 border-t border-white/8 space-y-1">
                    {allUnlockCodes.map((code, i) => (
                      <InfoRow
                        key={i}
                        icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
                        label={i === 0 ? "Unlock Key" : `Key ${i + 1}`}
                        value={code}
                        tooltip="Garmin map unlock code"
                        labelWidth="w-[64px]"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-white/30 italic">No map detected on this card</p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ── RemovableItem ─────────────────────────────────────────────────────────────

function RemovableItem({ device: d }: { device: DetectedDevice }) {
  const driveMatch = d.mountpoint.match(/^([A-Za-z]:)/);
  const driveLabel = driveMatch ? `${driveMatch[1].toUpperCase()}\\` : d.mountpoint;

  return (
    <li className="flex items-center gap-2 px-2.5 py-1.5 border border-orange-500/35 rounded-lg bg-white/[0.02]">
      <span className="text-white/30 shrink-0">{IconPlug}</span>
      <span className="text-[10px] font-mono text-white/60 shrink-0">{driveLabel}</span>
      {d.label && <span className="text-[10px] text-white/30 truncate">{d.label}</span>}
    </li>
  );
}

// ── Brand icon ──────────────────────────────────────────────────────────────

function BrmPinIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.25)}
      viewBox="0 0 24 30"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sidebarPinGrad" x1="12" y1="0" x2="12" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#E07810" />
        </linearGradient>
      </defs>
      <path
        d="M12 0C5.37 0 0 5.37 0 12c0 8.33 12 18 12 18S24 20.33 24 12C24 5.37 18.63 0 12 0z"
        fill="url(#sidebarPinGrad)"
      />
      <circle cx="12" cy="11" r="4.5" fill="white" fillOpacity="0.85" />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface MapMeta {
  name: string;
  acronym: string;
  version: string;
  img_path?: string;
  pc_download_path?: string;
  mac_download_path?: string;
  pc_update_path_sd?: string;
  pc_update_path_digital?: string;
  poi_update_path?: string;
}

interface SdReg {
  id: number;
  map_number: string;
  esn: string;
  unlock_code?: string;
  unl_file_url?: string;
  companion_file_url?: string;
  updated_map: boolean;
  download_expiry?: string;
  update_expiry?: string;
  maps: MapMeta | MapMeta[];
}

interface DigitalReg {
  id: number;
  map_number: string;
  gps_unit_id: string;
  unlock_code?: string;
  unl_file_url?: string;
  gma_file_url?: string;
  updated_map: boolean;
  download_expiry?: string;
  update_expiry?: string;
  maps: MapMeta | MapMeta[];
}

interface UpdateCredit {
  id: number;
  type: "SD" | "DIGITAL";
  new_map_number: string;
  new_map?: { name: string; acronym: string };
}

interface Props {
  onLogout: () => void;
}

function resolveMap(maps: MapMeta | MapMeta[] | null | undefined): MapMeta | null {
  if (!maps) return null;
  return Array.isArray(maps) ? (maps[0] ?? null) : maps;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ onLogout }: Props) {
  const [sdRegs, setSdRegs] = useState<SdReg[]>([]);
  const [digitalRegs, setDigitalRegs] = useState<DigitalReg[]>([]);
  const [credits, setCredits] = useState<UpdateCredit[]>([]);
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transferReg, setTransferReg] = useState<{ id: number; type: "sd" | "digital"; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = (mp: string) =>
    setExpanded(prev => ({ ...prev, [mp]: !prev[mp] }));

  useEffect(() => {
    loadRegistrations();
    window.brm.listDevices().then(setDevices);
    const unsub = window.brm.onDevicesChanged(setDevices);
    return unsub;
  }, []);

  async function loadRegistrations() {
    setLoading(true);
    setError("");
    try {
      const stored = await window.brm.checkAuth();
      if (!stored) { onLogout(); return; }
      const desktopToken = await window.brm.getToken();
      if (!desktopToken) { onLogout(); return; }
      const res = await fetch(`${BRM_API}/api/desktop/registrations`, {
        headers: { "X-Desktop-Token": desktopToken },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as {
        sdRegistrations: SdReg[];
        digitalRegistrations: DigitalReg[];
        updateCredits: UpdateCredit[];
      };
      setSdRegs(data.sdRegistrations);
      setDigitalRegs(data.digitalRegistrations);
      setCredits(data.updateCredits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const hasCredit = (type: "SD" | "DIGITAL") => credits.some((c) => c.type === type);

  return (
    <div className="flex h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-72 relative flex flex-col shrink-0 overflow-hidden bg-black">
        {/* SideBG texture at 5% — sits on solid black, no body BG bleed */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${sidebarBgUrl})`, opacity: 0.10 }}
        />

        {/* Logo banner */}
        <div className="relative z-10 px-4 py-4 border-b border-white/10 flex flex-col items-center gap-1.5">
          <img src={logoUrl} alt="BackroadMapBooks" className="h-8 w-auto" />
          <p className="text-[10px] text-white/50 uppercase tracking-widest">Map Loader</p>
        </div>

        {/* Device panels */}
        <div className="relative z-10 px-4 py-4 flex-1 overflow-y-auto space-y-5">

          {/* Connected Devices — GPS units + SD cards */}
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-3">
              Connected Devices
            </p>
            {(() => {
              const connected = devices.filter(d => d.type === "garmin" || d.type === "sd");
              return connected.length === 0 ? (
                <p className="text-xs text-white/40 leading-relaxed">
                  No devices detected.<br />Connect a GPS unit or SD card.
                </p>
              ) : (
                <ul className="space-y-2">
                  {connected.map(d =>
                    d.type === "garmin"
                      ? <GpsCard key={d.mountpoint} device={d} expanded={!!expanded[d.mountpoint]} onToggle={() => toggleExpanded(d.mountpoint)} />
                      : <SdCard key={d.mountpoint} device={d} expanded={!!expanded[d.mountpoint]} onToggle={() => toggleExpanded(d.mountpoint)} />
                  )}
                </ul>
              );
            })()}
          </div>

          {/* Removable Devices — drives without a Garmin folder */}
          {devices.some(d => d.type === "unknown") && (
            <div>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">
                Removable Devices
              </p>
              <ul className="space-y-1.5">
                {devices.filter(d => d.type === "unknown").map(d => (
                  <RemovableItem key={d.mountpoint} device={d} />
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="relative z-10 px-4 py-3 border-t border-white/10">
          <button
            onClick={onLogout}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-brm-parchment border-b border-brm-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">My Maps</h2>
          <button
            onClick={loadRegistrations}
            className="text-xs text-brm-amber-600 hover:text-brm-amber-700 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {loading && (
            <p className="text-sm text-gray-400">Loading…</p>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          {!loading && !error && sdRegs.length === 0 && digitalRegs.length === 0 && (
            <p className="text-sm text-gray-400">No registered maps found.</p>
          )}

          {/* ── Update credits banner ── */}
          {credits.length > 0 && (
            <div className="bg-brm-amber-50 border border-brm-amber-400/40 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2">
                <BrmPinIcon size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-brm-amber-700 mb-1">Map updates available</p>
                  {credits.map((c) => (
                    <p key={c.id} className="text-xs text-brm-amber-600">
                      · {c.new_map?.name ?? c.new_map_number} ({c.type})
                    </p>
                  ))}
                  <p className="text-xs text-brm-amber-600/70 mt-1">
                    Visit your account page to apply updates.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── SD Maps ── */}
          {sdRegs.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-3">
                SD Maps
              </h3>
              <div className="space-y-3">
                {sdRegs.map((reg) => {
                  const map = resolveMap(reg.maps);
                  return (
                    <MapCard
                      key={`sd-${reg.id}`}
                      name={map?.name ?? reg.map_number}
                      imgPath={map?.img_path}
                      badge="SD Card"
                      esn={reg.esn}
                      unlockCode={reg.unlock_code}
                      version={map?.version ?? reg.map_number}
                      hasUpdate={hasCredit("SD")}
                      downloadExpiry={reg.download_expiry}
                      pcDownloadUrl={map?.pc_download_path}
                      macDownloadUrl={map?.mac_download_path}
                      mapAcronym={map?.acronym}
                      gmaFileUrl={reg.companion_file_url}
                      unlFileUrl={reg.unl_file_url}
                      devices={devices}
                      onTransfer={() => setTransferReg({ id: reg.id, type: "sd", name: map?.name ?? reg.map_number })}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Digital Maps ── */}
          {digitalRegs.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-3">
                Digital Maps
              </h3>
              <div className="space-y-3">
                {digitalRegs.map((reg) => {
                  const map = resolveMap(reg.maps);
                  return (
                    <MapCard
                      key={`digital-${reg.id}`}
                      name={map?.name ?? reg.map_number}
                      imgPath={map?.img_path}
                      badge="Digital"
                      gpsUnitId={reg.gps_unit_id}
                      unlockCode={reg.unlock_code}
                      version={map?.version ?? reg.map_number}
                      hasUpdate={hasCredit("DIGITAL")}
                      downloadExpiry={reg.download_expiry}
                      pcDownloadUrl={map?.pc_download_path}
                      macDownloadUrl={map?.mac_download_path}
                      mapAcronym={map?.acronym}
                      gmaFileUrl={reg.gma_file_url}
                      unlFileUrl={reg.unl_file_url}
                      devices={devices}
                      onTransfer={() => setTransferReg({ id: reg.id, type: "digital", name: map?.name ?? reg.map_number })}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {transferReg && (
        <Transfer
          registrationId={transferReg.id}
          registrationType={transferReg.type}
          mapName={transferReg.name}
          devices={devices}
          onClose={() => setTransferReg(null)}
        />
      )}
    </div>
  );
}

// ── MapCard ───────────────────────────────────────────────────────────────────

interface MapCardProps {
  name: string;
  imgPath?: string;
  badge: string;
  esn?: string;
  gpsUnitId?: string;
  version: string;
  unlockCode?: string;
  hasUpdate: boolean;
  downloadExpiry?: string;
  pcDownloadUrl?: string;
  macDownloadUrl?: string;
  mapAcronym?: string;
  gmaFileUrl?: string;
  unlFileUrl?: string;
  devices: DetectedDevice[];
  onTransfer: () => void;
}

function MapCard({
  name, imgPath, badge, esn, gpsUnitId, version, unlockCode, hasUpdate,
  downloadExpiry, pcDownloadUrl, macDownloadUrl,
  mapAcronym, gmaFileUrl, unlFileUrl, devices, onTransfer,
}: MapCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [basecampStage, setBasecampStage] = useState("");
  const [basecampPercent, setBasecampPercent] = useState(0);
  const [basecampError, setBasecampError] = useState("");
  const [basecampDone, setBasecampDone] = useState(false);
  const [installing, setInstalling] = useState(false);

  const now = new Date();
  const isDownloadExpired = downloadExpiry ? new Date(downloadExpiry) < now : false;
  const hasBasecampUrl = !!(pcDownloadUrl || macDownloadUrl) && !isDownloadExpired;

  const handleBasecampInstall = useCallback(async () => {
    if (installing || basecampDone) return;
    setInstalling(true);
    setBasecampError("");
    setBasecampStage("Starting…");
    setBasecampPercent(0);

    const unsub = window.brm.onBasecampProgress(({ stage, percent }) => {
      setBasecampStage(stage);
      setBasecampPercent(percent);
    });

    const result = await window.brm.downloadBasecamp({
      pcDownloadUrl: pcDownloadUrl ?? "",
      macDownloadUrl: macDownloadUrl ?? "",
      mapName: name,
      mapAcronym,
      gmaFileUrl,
      unlFileUrl,
    });

    unsub();
    setInstalling(false);

    if ("error" in result && result.error) {
      setBasecampError(result.error as string);
    } else {
      setBasecampDone(true);
    }
  }, [installing, basecampDone, pcDownloadUrl, macDownloadUrl, name]);

  return (
    <div className="bg-white border border-brm-border rounded-xl p-4 shadow-sm">
      {/* Top row: thumbnail · info · transfer button */}
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-brm-parchment border border-brm-border shrink-0 overflow-hidden flex items-center justify-center">
          {imgPath && !imgFailed ? (
            <img
              src={imgPath}
              alt=""
              className="w-full h-full object-cover block"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <BrmPinIcon size={22} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-semibold text-gray-900 text-sm truncate max-w-xs">{name}</span>
            <span className="text-[10px] font-semibold bg-brm-forest-800/10 text-gray-900 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide">
              {badge}
            </span>
            {hasUpdate && (
              <span className="text-[10px] font-semibold bg-brm-amber-50 text-brm-amber-700 px-1.5 py-0.5 rounded-full shrink-0 border border-brm-amber-400/30">
                Update available
              </span>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            {esn && (
              <p className="text-xs text-gray-500">
                <span className="text-gray-400 font-medium">ESN:</span> {esn}
              </p>
            )}
            {gpsUnitId && (
              <p className="text-xs text-gray-500">
                <span className="text-gray-400 font-medium">GPS Unit:</span> {gpsUnitId}
              </p>
            )}
            <p className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">Version:</span> {version}
            </p>
            {unlockCode && (
              <p className="text-xs text-gray-500 font-mono break-all">
                <span className="text-gray-400 font-medium font-sans">Unlock:</span> {unlockCode}
              </p>
            )}
          </div>
          {isDownloadExpired ? (
            <p className="text-xs text-red-500 mt-1">Downloads expired</p>
          ) : downloadExpiry ? (
            <p className="text-xs text-gray-400 mt-1">
              Downloads expire {new Date(downloadExpiry).toLocaleDateString()}
            </p>
          ) : null}
        </div>

        {/* Transfer button */}
        <div className="shrink-0">
          {devices.length > 0 ? (
            <button
              onClick={onTransfer}
              className="bg-brm-amber-500 hover:bg-brm-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Load to Device
            </button>
          ) : (
            <span className="text-xs text-gray-400 whitespace-nowrap">No device</span>
          )}
        </div>
      </div>

      {/* Basecamp install row */}
      {hasBasecampUrl && (
        <div className="mt-3 pt-3 border-t border-brm-border">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700">Install in Garmin Basecamp</p>
              {installing && (
                <>
                  <p className="text-xs text-brm-amber-600 mt-0.5">{basecampStage}</p>
                  <div className="w-full bg-brm-parchment rounded-full h-1.5 mt-1.5 border border-brm-border">
                    <div
                      className="bg-brm-amber-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${basecampPercent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{basecampPercent}%</p>
                </>
              )}
              {basecampDone && (
                <p className="text-xs text-brm-forest-800 mt-0.5 font-medium">✓ Installed to Basecamp Maps folder</p>
              )}
              {basecampError && (
                <p className="text-xs text-red-500 mt-0.5">{basecampError}</p>
              )}
            </div>
            {!basecampDone && (
              <button
                onClick={handleBasecampInstall}
                disabled={installing}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap
                  ${installing
                    ? "border-brm-border text-gray-400 cursor-not-allowed"
                    : "border-brm-amber-500 text-brm-amber-600 hover:bg-brm-amber-50"}`}
              >
                {installing ? basecampStage || "Installing…" : "Install in Basecamp"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

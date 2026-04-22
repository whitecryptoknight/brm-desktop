import { useEffect, useState } from "react";
import type { DetectedDevice } from "../../../main/devices";
import Transfer from "./Transfer";

const BRM_API = import.meta.env.VITE_BRM_API_URL ?? "https://dev.brmb.support";

interface MapMeta {
  name: string;
  acronym: string;
  version: string;
  img_path: string;
  pc_download_path: string;
  mac_download_path: string;
  gpi_path: string;
}

interface SdReg {
  id: number;
  map_number: string;
  esn: string;
  unl_file_url: string;
  companion_file_url: string;
  updated_map: boolean;
  download_expiry: string;
  maps: MapMeta;
}

interface DigitalReg {
  id: number;
  map_number: string;
  gps_unit_id: string;
  unl_file_url: string;
  gma_file_url: string;
  updated_map: boolean;
  download_expiry: string;
  maps: MapMeta;
}

interface UpdateCredit {
  id: number;
  type: "SD" | "DIGITAL";
  new_map_number: string;
  new_map: { name: string; acronym: string };
}

interface Props {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: Props) {
  const [sdRegs, setSdRegs] = useState<SdReg[]>([]);
  const [digitalRegs, setDigitalRegs] = useState<DigitalReg[]>([]);
  const [credits, setCredits] = useState<UpdateCredit[]>([]);
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Transfer state
  const [transferReg, setTransferReg] = useState<{ id: number; type: "sd" | "digital"; name: string } | null>(null);

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

      // The desktop app calls via IPC → main process fetches the API
      // Here we call directly from renderer using the token stored in main
      // (In production, main process should proxy this; for now renderer calls the API directly)
      const res = await fetch(`${BRM_API}/api/desktop/registrations`, {
        headers: { "X-Customer-Token": await getToken() },
      });
      if (!res.ok) throw new Error("Failed to load registrations");
      const data = await res.json() as { sdRegistrations: SdReg[]; digitalRegistrations: DigitalReg[]; updateCredits: UpdateCredit[] };
      setSdRegs(data.sdRegistrations);
      setDigitalRegs(data.digitalRegistrations);
      setCredits(data.updateCredits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Temporary: retrieve token via IPC check (in a real build, main proxies the fetch)
  async function getToken(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__brmToken ?? "";
  }

  const pendingCredits = credits.filter((c) => !c.new_map_number);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <h1 className="font-bold text-gray-900 text-sm">BRM Map Loader</h1>
        </div>

        {/* Connected devices */}
        <div className="px-4 py-4 flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Connected Devices</p>
          {devices.length === 0 ? (
            <p className="text-xs text-gray-400">No devices detected.<br />Connect a GPS unit or SD card.</p>
          ) : (
            <ul className="space-y-1">
              {devices.map((d) => (
                <li key={d.mountpoint} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500">●</span>
                  <div>
                    <div className="font-medium truncate">{d.label}</div>
                    <div className="text-xs text-gray-400">{d.type === "garmin" ? "GPS Unit" : d.type === "sd" ? "SD Card" : "Removable"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">My Maps</h2>
          <button onClick={loadRegistrations} className="text-xs text-green-600 hover:underline">Refresh</button>
        </div>

        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && sdRegs.length === 0 && digitalRegs.length === 0 && (
          <p className="text-sm text-gray-400">No registered maps found.</p>
        )}

        {/* SD Registrations */}
        {sdRegs.map((reg) => (
          <MapCard
            key={`sd-${reg.id}`}
            title={reg.maps.name}
            subtitle={`SD Card · ESN: ${reg.esn}`}
            version={reg.maps.version}
            hasUpdate={credits.some((c) => c.type === "SD")}
            devices={devices}
            onTransfer={(mp) => setTransferReg({ id: reg.id, type: "sd", name: reg.maps.name })}
          />
        ))}

        {/* Digital Registrations */}
        {digitalRegs.map((reg) => (
          <MapCard
            key={`digital-${reg.id}`}
            title={reg.maps.name}
            subtitle={`Digital · Unit: ${reg.gps_unit_id}`}
            version={reg.maps.version}
            hasUpdate={credits.some((c) => c.type === "DIGITAL")}
            devices={devices}
            onTransfer={(mp) => setTransferReg({ id: reg.id, type: "digital", name: reg.maps.name })}
          />
        ))}

        {/* Pending update credits */}
        {pendingCredits.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Pending Updates</h3>
            {pendingCredits.map((c) => (
              <div key={c.id} className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800 mb-2">
                Update available: <strong>{c.new_map?.name ?? c.new_map_number}</strong> ({c.type})
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Transfer modal */}
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

function MapCard({
  title, subtitle, version, hasUpdate, devices, onTransfer,
}: {
  title: string;
  subtitle: string;
  version: string;
  hasUpdate: boolean;
  devices: DetectedDevice[];
  onTransfer: (mountpoint: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-3 flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        <p className="text-xs text-gray-400">Version {version}</p>
        {hasUpdate && (
          <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Update available</span>
        )}
      </div>
      <div className="flex gap-2">
        {devices.length > 0 ? (
          <button
            onClick={() => onTransfer(devices[0].mountpoint)}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Load to Device
          </button>
        ) : (
          <span className="text-xs text-gray-400">No device connected</span>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { DetectedDevice } from "../../../main/devices";

interface Props {
  registrationId: number;
  registrationType: "sd" | "digital";
  mapName: string;
  devices: DetectedDevice[];
  onClose: () => void;
}

export default function Transfer({ registrationId, registrationType, mapName, devices, onClose }: Props) {
  const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(devices[0] ?? null);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState("");
  const [percent, setPercent] = useState(0);
  const [fileProgress, setFileProgress] = useState("");
  const [mapExists, setMapExists] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    return () => cleanupRef.current.forEach((fn) => fn());
  }, []);

  useEffect(() => {
    if (!selectedDevice) { setMapExists(false); return; }
    window.brm.checkDeviceMap(selectedDevice.mountpoint).then(({ exists }) => setMapExists(exists));
  }, [selectedDevice?.mountpoint]);

  async function startTransfer() {
    if (!selectedDevice) return;
    setStarted(true);
    setError("");

    const unsubProgress = window.brm.onTransferProgress(({ stage: s, percent: p }) => {
      setStage(s);
      setPercent(p);
    });
    const unsubFile = window.brm.onFileProgress(({ label, percent: p }) => {
      setFileProgress(`${label}: ${p}%`);
    });
    cleanupRef.current = [unsubProgress, unsubFile];

    const result = await window.brm.startTransfer({
      registrationId,
      registrationType,
      deviceMountpoint: selectedDevice.mountpoint,
    });

    if (result.error) {
      setError(result.error);
      setStarted(false);
    } else {
      setDone(true);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal header */}
        <div className="bg-brm-forest-800 px-6 py-4">
          <h2 className="text-base font-bold text-white">Load Map to Device</h2>
          <p className="text-sm text-white/60 mt-0.5">{mapName}</p>
        </div>

        <div className="px-6 py-5">
          {!started && !done && (
            <>
              <p className="text-sm font-medium text-gray-700 mb-3">Select destination:</p>
              {devices.length === 0 ? (
                <p className="text-sm text-red-500 mb-4">No devices connected. Connect a GPS unit or SD card and try again.</p>
              ) : (
                <div className="space-y-2 mb-5">
                  {devices.map((d) => (
                    <label key={d.mountpoint} className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-brm-parchment transition-colors">
                      <input
                        type="radio"
                        name="device"
                        checked={selectedDevice?.mountpoint === d.mountpoint}
                        onChange={() => { setSelectedDevice(d); setMapExists(false); }}
                        className="accent-brm-amber-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">{d.label}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {d.type === "garmin" ? "GPS Unit" : d.type === "sd" ? "SD Card" : "Removable"} · {d.mountpoint}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {mapExists ? (
                <div className="bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 mb-4">
                  <p className="text-xs font-semibold text-orange-700 mb-0.5">Map already installed</p>
                  <p className="text-xs text-orange-600">
                    A <code className="font-mono">gmapsupp.img</code> already exists on this device. Starting the transfer will replace it.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-brm-amber-50 border border-brm-amber-400/30 rounded-lg px-3 py-2 mb-4">
                  No existing map detected on this device.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={startTransfer}
                  disabled={!selectedDevice || devices.length === 0}
                  className="flex-1 bg-brm-amber-500 hover:bg-brm-amber-600 disabled:opacity-40 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
                >
                  Start Transfer
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 border border-brm-border text-gray-600 font-medium py-2 rounded-lg text-sm hover:bg-brm-parchment transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {started && !done && (
            <div className="py-2">
              <p className="text-sm text-gray-700 font-medium mb-3">{stage}</p>
              <div className="w-full bg-brm-parchment rounded-full h-2 mb-2 border border-brm-border">
                <div
                  className="bg-brm-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{percent}% complete</p>
              {fileProgress && <p className="text-xs text-gray-400 mt-1">{fileProgress}</p>}
            </div>
          )}

          {error && (
            <div className="mt-3">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <button onClick={onClose} className="w-full border border-brm-border text-gray-600 py-2 rounded-lg text-sm hover:bg-brm-parchment">Close</button>
            </div>
          )}

          {done && (
            <div className="py-2 text-center">
              <div className="w-12 h-12 bg-brm-forest-800/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-brm-forest-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p className="text-brm-forest-800 font-semibold text-sm mb-1">Transfer complete!</p>
              <p className="text-xs text-gray-500 mb-5">
                Maps loaded to {selectedDevice?.label}. Safely eject your device before unplugging.
              </p>
              <button onClick={onClose} className="w-full bg-brm-forest-800 hover:bg-brm-forest-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

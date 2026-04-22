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
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    return () => cleanupRef.current.forEach((fn) => fn());
  }, []);

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Load Map to Device</h2>
        <p className="text-sm text-gray-500 mb-4">{mapName}</p>

        {!started && !done && (
          <>
            <p className="text-sm font-medium text-gray-700 mb-2">Select destination:</p>
            {devices.length === 0 ? (
              <p className="text-sm text-red-500">No devices connected. Connect a GPS unit or SD card and try again.</p>
            ) : (
              <div className="space-y-2 mb-5">
                {devices.map((d) => (
                  <label key={d.mountpoint} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="device"
                      checked={selectedDevice?.mountpoint === d.mountpoint}
                      onChange={() => setSelectedDevice(d)}
                      className="accent-green-600"
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

            <p className="text-xs text-amber-600 mb-4">
              ⚠ This will overwrite any existing map in the Garmin folder on the selected device.
            </p>

            <div className="flex gap-3">
              <button
                onClick={startTransfer}
                disabled={!selectedDevice || devices.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Start Transfer
              </button>
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </>
        )}

        {started && !done && (
          <div className="py-2">
            <p className="text-sm text-gray-700 font-medium mb-3">{stage}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
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
            <button onClick={onClose} className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Close</button>
          </div>
        )}

        {done && (
          <div className="py-2 text-center">
            <p className="text-green-600 font-semibold text-sm mb-1">Transfer complete!</p>
            <p className="text-xs text-gray-500 mb-4">
              Maps loaded to {selectedDevice?.label}. Safely eject your device before unplugging.
            </p>
            <button onClick={onClose} className="w-full bg-green-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-green-700">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

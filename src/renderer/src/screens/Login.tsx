import { useState } from "react";
import logoUrl from "../assets/Backroad-Maps-Horizontal-Logo.avif";
import loginBgUrl from "../assets/loginBG.jpg";

interface Props {
  onLogin: (customerId: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setError("");
    setLoading(true);
    const result = await window.brm.verifyToken(token.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.customerId) {
      onLogin(result.customerId);
    }
  }

  return (
    <div
      className="flex items-center justify-center h-screen bg-black bg-cover bg-center"
      style={{ backgroundImage: `url(${loginBgUrl})` }}
    >
      {/* Subtle dark scrim so the card reads cleanly */}
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />

      <div className="relative w-full max-w-sm shadow-2xl rounded-2xl overflow-hidden">
        {/* Logo banner — black */}
        <div className="bg-black px-8 py-7 flex flex-col items-center justify-center gap-2">
          <img
            src={logoUrl}
            alt="BackroadMapBooks"
            className="h-12 w-auto"
          />
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Map Loader</p>
        </div>

        {/* Form body */}
        <div className="bg-white px-8 py-7">
          <p className="text-sm text-gray-500 mb-1">Sign in with your desktop access token.</p>
          <p className="text-xs text-gray-400 mb-5">
            Account → GPS Maps → Desktop App → Generate Desktop Token
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your desktop token here"
              className="w-full border border-brm-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brm-amber-500 bg-brm-parchment placeholder:text-gray-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full bg-brm-amber-500 hover:bg-brm-amber-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? "Verifying…" : "Sign In"}
            </button>
          </form>

          {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";

interface Props {
  onLogin: (customerId: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setError("");
    setLoading(true);

    const result = await window.brm.startLogin();

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.customerId) {
      onLogin(result.customerId);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-1">BRM Map Loader</h1>
        <p className="text-sm text-gray-500 mb-8">
          Sign in with your BackroadMapBooks account to access your registered maps.
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
        >
          {loading ? "Opening browser…" : "Sign in with Shopify"}
        </button>

        {loading && (
          <p className="text-xs text-gray-400 mt-3">
            Complete sign-in in your browser, then return here.
          </p>
        )}

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}

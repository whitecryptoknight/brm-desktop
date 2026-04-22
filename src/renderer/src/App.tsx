import { useEffect, useState } from "react";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";

export default function App() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    window.brm.checkAuth().then((result) => {
      setCustomerId(result?.customerId ?? null);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!customerId) {
    return <Login onLogin={(id) => setCustomerId(id)} />;
  }

  return <Dashboard onLogout={() => setCustomerId(null)} />;
}

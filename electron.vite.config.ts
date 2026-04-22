import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) so main process can use them
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_BRM_API_URL || "https://dev.brmb.support";

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        // Inject at build time so process.env.BRM_API_URL works in main process
        "process.env.BRM_API_URL": JSON.stringify(apiUrl),
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      plugins: [react()],
    },
  };
});

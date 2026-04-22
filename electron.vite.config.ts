import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) so main process can use them
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_BRM_API_URL || "https://dev.brmb.support";
  const shopDomain = env.VITE_SHOPIFY_STORE_DOMAIN || "backroadmapbooks.myshopify.com";
  const clientId = env.VITE_SHOPIFY_CLIENT_ID || "";

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        "process.env.BRM_API_URL": JSON.stringify(apiUrl),
        "process.env.SHOP_DOMAIN": JSON.stringify(shopDomain),
        "process.env.SHOPIFY_CLIENT_ID": JSON.stringify(clientId),
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

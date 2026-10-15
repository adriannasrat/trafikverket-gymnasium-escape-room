import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "API_PROXY_");
  const apiProxyTarget = environment.API_PROXY_TARGET || "http://localhost:8088";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": apiProxyTarget,
        "/health": apiProxyTarget,
        "/uploads": apiProxyTarget,
      },
    },
  };
});

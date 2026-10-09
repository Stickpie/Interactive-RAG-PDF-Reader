import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The React app calls /api/... A local FastAPI server serves those routes at
// its root, so /api is stripped only for localhost. A public site such as
// https://inkling.alisacore.com already expects the /api prefix.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY || "http://127.0.0.1:8000";
  const localApi = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(apiTarget);
  const proxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
      ...(localApi
        ? { rewrite: (path: string) => path.replace(/^\/api/, "") || "/" }
        : {}),
    },
  };

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy,
    },
    preview: {
      host: true,
      port: 4173,
      proxy,
    },
  };
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The React app calls /api/... The FastAPI routes live at the server root
// (root_path does not prefix them), so the dev server strips /api.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY || "http://127.0.0.1:8000";
  const proxy = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, "") || "/",
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

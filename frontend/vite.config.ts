import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8083,
    allowedHosts: ["dutychart.ntc.net.np"],

    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    {
      name: "emit-telecom-image",
      apply: "build",
      generateBundle() {
        try {
          const srcPath = path.resolve(__dirname, "./src/assets/telecom.png");
          const source = fs.readFileSync(srcPath);
          this.emitFile({
            type: "asset",
            fileName: "telecom.png",
            source,
          });
        } catch (e) {
          // silently ignore if file is missing
        }
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

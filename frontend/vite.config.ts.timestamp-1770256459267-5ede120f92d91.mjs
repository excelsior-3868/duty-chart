// vite.config.ts
import { defineConfig } from "file:///E:/GitHub/duty-chart/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///E:/GitHub/duty-chart/frontend/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import fs from "fs";
import { componentTagger } from "file:///E:/GitHub/duty-chart/frontend/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "E:\\GitHub\\duty-chart\\frontend";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    allowedHosts: ["dutychart.ntc.net.np"]
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "emit-telecom-image",
      apply: "build",
      generateBundle() {
        try {
          const srcPath = path.resolve(__vite_injected_original_dirname, "./src/assets/telecom.png");
          const source = fs.readFileSync(srcPath);
          this.emitFile({
            type: "asset",
            fileName: "telecom.png",
            source
          });
        } catch (e) {
        }
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxHaXRIdWJcXFxcZHV0eS1jaGFydFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcR2l0SHViXFxcXGR1dHktY2hhcnRcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L0dpdEh1Yi9kdXR5LWNoYXJ0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgyLFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXCJkdXR5Y2hhcnQubnRjLm5ldC5ucFwiXSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBtb2RlID09PSAnZGV2ZWxvcG1lbnQnICYmXHJcbiAgICBjb21wb25lbnRUYWdnZXIoKSxcclxuICAgIHtcclxuICAgICAgbmFtZTogXCJlbWl0LXRlbGVjb20taW1hZ2VcIixcclxuICAgICAgYXBwbHk6IFwiYnVpbGRcIixcclxuICAgICAgZ2VuZXJhdGVCdW5kbGUoKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IHNyY1BhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL2Fzc2V0cy90ZWxlY29tLnBuZ1wiKTtcclxuICAgICAgICAgIGNvbnN0IHNvdXJjZSA9IGZzLnJlYWRGaWxlU3luYyhzcmNQYXRoKTtcclxuICAgICAgICAgIHRoaXMuZW1pdEZpbGUoe1xyXG4gICAgICAgICAgICB0eXBlOiBcImFzc2V0XCIsXHJcbiAgICAgICAgICAgIGZpbGVOYW1lOiBcInRlbGVjb20ucG5nXCIsXHJcbiAgICAgICAgICAgIHNvdXJjZSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZSBpZiBmaWxlIGlzIG1pc3NpbmdcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVIsU0FBUyxvQkFBb0I7QUFDOVMsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFDZixTQUFTLHVCQUF1QjtBQUpoQyxJQUFNLG1DQUFtQztBQU96QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLGNBQWMsQ0FBQyxzQkFBc0I7QUFBQSxFQUN2QztBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFDVCxnQkFBZ0I7QUFBQSxJQUNoQjtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsaUJBQWlCO0FBQ2YsWUFBSTtBQUNGLGdCQUFNLFVBQVUsS0FBSyxRQUFRLGtDQUFXLDBCQUEwQjtBQUNsRSxnQkFBTSxTQUFTLEdBQUcsYUFBYSxPQUFPO0FBQ3RDLGVBQUssU0FBUztBQUFBLFlBQ1osTUFBTTtBQUFBLFlBQ04sVUFBVTtBQUFBLFlBQ1Y7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNILFNBQVMsR0FBRztBQUFBLFFBRVo7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0YsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K

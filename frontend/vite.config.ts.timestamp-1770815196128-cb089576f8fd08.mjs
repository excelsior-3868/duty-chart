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
    port: 8083,
    allowedHosts: ["dutychart.ntc.net.np"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false
      }
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxHaXRIdWJcXFxcZHV0eS1jaGFydFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcR2l0SHViXFxcXGR1dHktY2hhcnRcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L0dpdEh1Yi9kdXR5LWNoYXJ0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgzLFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXCJkdXR5Y2hhcnQubnRjLm5ldC5ucFwiXSxcclxuXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbW9kZSA9PT0gJ2RldmVsb3BtZW50JyAmJlxyXG4gICAgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6IFwiZW1pdC10ZWxlY29tLWltYWdlXCIsXHJcbiAgICAgIGFwcGx5OiBcImJ1aWxkXCIsXHJcbiAgICAgIGdlbmVyYXRlQnVuZGxlKCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBzcmNQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9hc3NldHMvdGVsZWNvbS5wbmdcIik7XHJcbiAgICAgICAgICBjb25zdCBzb3VyY2UgPSBmcy5yZWFkRmlsZVN5bmMoc3JjUGF0aCk7XHJcbiAgICAgICAgICB0aGlzLmVtaXRGaWxlKHtcclxuICAgICAgICAgICAgdHlwZTogXCJhc3NldFwiLFxyXG4gICAgICAgICAgICBmaWxlTmFtZTogXCJ0ZWxlY29tLnBuZ1wiLFxyXG4gICAgICAgICAgICBzb3VyY2UsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmUgaWYgZmlsZSBpcyBtaXNzaW5nXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICBdLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlSLFNBQVMsb0JBQW9CO0FBQzlTLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxRQUFRO0FBQ2YsU0FBUyx1QkFBdUI7QUFKaEMsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixjQUFjLENBQUMsc0JBQXNCO0FBQUEsSUFFckMsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFDVCxnQkFBZ0I7QUFBQSxJQUNoQjtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsaUJBQWlCO0FBQ2YsWUFBSTtBQUNGLGdCQUFNLFVBQVUsS0FBSyxRQUFRLGtDQUFXLDBCQUEwQjtBQUNsRSxnQkFBTSxTQUFTLEdBQUcsYUFBYSxPQUFPO0FBQ3RDLGVBQUssU0FBUztBQUFBLFlBQ1osTUFBTTtBQUFBLFlBQ04sVUFBVTtBQUFBLFlBQ1Y7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNILFNBQVMsR0FBRztBQUFBLFFBRVo7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0YsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K

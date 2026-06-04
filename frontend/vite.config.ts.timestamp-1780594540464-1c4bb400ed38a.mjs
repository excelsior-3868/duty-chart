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
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false
      },
      "/swagger": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false
      },
      "/redoc": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false
      },
      "/api-auth": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxHaXRIdWJcXFxcZHV0eS1jaGFydFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcR2l0SHViXFxcXGR1dHktY2hhcnRcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L0dpdEh1Yi9kdXR5LWNoYXJ0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgzLFxyXG4gICAgYWxsb3dlZEhvc3RzOiBbXCJkdXR5Y2hhcnQubnRjLm5ldC5ucFwiXSxcclxuXHJcbiAgICBwcm94eToge1xyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9CQUNLRU5EX1VSTCB8fCBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9zd2FnZ2VyXCI6IHtcclxuICAgICAgICB0YXJnZXQ6IHByb2Nlc3MuZW52LlZJVEVfQkFDS0VORF9VUkwgfHwgXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfSxcclxuICAgICAgXCIvcmVkb2NcIjoge1xyXG4gICAgICAgIHRhcmdldDogcHJvY2Vzcy5lbnYuVklURV9CQUNLRU5EX1VSTCB8fCBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9hcGktYXV0aFwiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBwcm9jZXNzLmVudi5WSVRFX0JBQ0tFTkRfVVJMIHx8IFwiaHR0cDovLzEyNy4wLjAuMTo4MDAwXCIsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiZcclxuICAgIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAge1xyXG4gICAgICBuYW1lOiBcImVtaXQtdGVsZWNvbS1pbWFnZVwiLFxyXG4gICAgICBhcHBseTogXCJidWlsZFwiIGFzIGNvbnN0LFxyXG4gICAgICBnZW5lcmF0ZUJ1bmRsZSgpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgY29uc3Qgc3JjUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvYXNzZXRzL3RlbGVjb20ucG5nXCIpO1xyXG4gICAgICAgICAgY29uc3Qgc291cmNlID0gZnMucmVhZEZpbGVTeW5jKHNyY1BhdGgpO1xyXG4gICAgICAgICAgdGhpcy5lbWl0RmlsZSh7XHJcbiAgICAgICAgICAgIHR5cGU6IFwiYXNzZXRcIixcclxuICAgICAgICAgICAgZmlsZU5hbWU6IFwidGVsZWNvbS5wbmdcIixcclxuICAgICAgICAgICAgc291cmNlLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlIGlmIGZpbGUgaXMgbWlzc2luZ1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpUixTQUFTLG9CQUFvQjtBQUM5UyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sUUFBUTtBQUNmLFNBQVMsdUJBQXVCO0FBSmhDLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYyxDQUFDLHNCQUFzQjtBQUFBLElBRXJDLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVEsUUFBUSxJQUFJLG9CQUFvQjtBQUFBLFFBQ3hDLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixRQUFRLFFBQVEsSUFBSSxvQkFBb0I7QUFBQSxRQUN4QyxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsUUFBUSxRQUFRLElBQUksb0JBQW9CO0FBQUEsUUFDeEMsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNYLFFBQVEsUUFBUSxJQUFJLG9CQUFvQjtBQUFBLFFBQ3hDLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFNBQVMsaUJBQ1QsZ0JBQWdCO0FBQUEsSUFDaEI7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLGlCQUFpQjtBQUNmLFlBQUk7QUFDRixnQkFBTSxVQUFVLEtBQUssUUFBUSxrQ0FBVywwQkFBMEI7QUFDbEUsZ0JBQU0sU0FBUyxHQUFHLGFBQWEsT0FBTztBQUN0QyxlQUFLLFNBQVM7QUFBQSxZQUNaLE1BQU07QUFBQSxZQUNOLFVBQVU7QUFBQSxZQUNWO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSCxTQUFTLEdBQUc7QUFBQSxRQUVaO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGLEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDaEIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==

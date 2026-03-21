import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "development" && {
      name: "access-logger",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const ip = req.socket.remoteAddress || "unknown";
          const url = req.url || "";
          if (!url.startsWith("/@") && !url.startsWith("/node_modules")) {
            console.log(`[access] ${new Date().toISOString()} ${ip} ${url}`);
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

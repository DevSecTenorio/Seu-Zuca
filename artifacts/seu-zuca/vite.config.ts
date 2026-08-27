import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";

  // PORT is only needed to run the dev/preview server; a production `build`
  // doesn't start a server, so it shouldn't require it (Vercel's build
  // environment doesn't set it).
  const rawPort = process.env.PORT;
  if (isServe && !rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  const port = rawPort ? Number(rawPort) : undefined;
  if (isServe && (port === undefined || Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH || "/";

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: port ?? 5173,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      ...(isServe && process.env.API_PROXY_TARGET
        ? {
            proxy: {
              "/api": {
                target: process.env.API_PROXY_TARGET,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
    preview: {
      port: port ?? 4173,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});

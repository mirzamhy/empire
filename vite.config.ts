import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./game", import.meta.url));

export default defineConfig({
  root,
  server: {
    host: "127.0.0.1",
    port: 5200,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL(".", import.meta.url))] },
  },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    outDir: fileURLToPath(new URL("./dist/game", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./game/index.html", import.meta.url)),
        units: fileURLToPath(new URL("./game/units.html", import.meta.url)),
        bosses: fileURLToPath(new URL("./game/bosses.html", import.meta.url)),
      },
    },
  },
});

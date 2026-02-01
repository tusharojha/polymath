import { defineConfig } from "electron-vite";
import path from "node:path";

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: "src/main.ts",
      },
      rollupOptions: {
        external: ["sql.js"],
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: "src/preload.ts",
      },
    },
  },
  renderer: {
    root: ".",
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        input: {
          main: path.join(__dirname, "index.html"),
        },
      },
    },
  },
});

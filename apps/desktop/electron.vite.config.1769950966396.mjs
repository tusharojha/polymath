// electron.vite.config.ts
import { defineConfig } from "electron-vite";
import path from "node:path";
var __electron_vite_injected_dirname = "/Volumes/JIL_INC/Projects/polymath/apps/desktop";
var electron_vite_config_default = defineConfig({
  main: {
    build: {
      lib: {
        entry: "src/main.ts"
      },
      rollupOptions: {
        external: ["sql.js"]
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: "src/preload.ts"
      }
    }
  },
  renderer: {
    root: ".",
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: {
          main: path.join(__electron_vite_injected_dirname, "index.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};

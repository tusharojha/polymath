import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("polymath", {
  version: "0.1.0",
  ping: () => true,
  brain: {
    start: (topic: string) => ipcRenderer.invoke("polymath:brain:start", { topic }),
    signal: (signal: unknown) => ipcRenderer.invoke("polymath:brain:signal", { signal }),
    state: () => ipcRenderer.invoke("polymath:brain:state"),
    onUpdate: (handler: (payload: unknown) => void) => {
      ipcRenderer.on("polymath:brain:update", (_event, payload) => handler(payload));
    },
    onStatusUpdate: (handler: (payload: { status: "thinking" | "idle" }) => void) => {
      ipcRenderer.on("polymath:brain:status", (_event, payload) => handler(payload));
    },
  },
});

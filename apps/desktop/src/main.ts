import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill for dependencies (like LangChain) that expect CommonJS globals
(globalThis as any).__filename = __filename;
(globalThis as any).__dirname = __dirname;

import { app, BrowserWindow, ipcMain } from "electron";
import dotenv from "dotenv";
import fs from "node:fs";
import os from "node:os";
import { BrainRuntime, BrainSupervisor } from "@polymath/brain";

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "..", ".env"),
  path.join(app.getAppPath(), "..", "..", ".env"),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#101014",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let brain: BrainSupervisor | null = null;
let lastState: unknown = null;

ipcMain.handle("polymath:brain:start", async (_event, payload: { topic: string }) => {
  try {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "thinking" })
    );
    const apiKey = process.env.OPENAI_API_KEY;
    const dbDir = path.join(os.homedir(), ".polymath");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const runtime = new BrainRuntime({
      userId: "user-1",
      goalId: "goal-1",
      topic: payload.topic,
      apiKey,
      dbPath: path.join(dbDir, "brain.sqlite"),
    });
    brain = new BrainSupervisor(runtime);
    const result = await brain.start({
      id: `signal-${Date.now()}`,
      userId: "user-1",
      goalId: "goal-1",
      type: "direct",
      observedAt: Date.now(),
      payload: { kind: "kickoff", source: "start" },
    });
    lastState = result;
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:update", result)
    );
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "idle" })
    );
    return { ok: true, data: result };
  } catch (err) {
    console.error("Failed to start brain:", err);
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "idle" })
    );
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle("polymath:brain:signal", async (_event, payload: { signal: unknown }) => {
  try {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "thinking" })
    );
    if (!brain) {
      throw new Error("Brain runtime not started.");
    }
    const result = await brain.signal(payload.signal as never);
    lastState = result;
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:update", result)
    );
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "idle" })
    );
    return { ok: true, data: result };
  } catch (err) {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("polymath:brain:status", { status: "idle" })
    );
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.handle("polymath:brain:state", async () => {
  return { ok: true, data: lastState };
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

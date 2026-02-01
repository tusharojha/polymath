import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import type { UnderstandingThesisGraph } from "./thesis";

export class BrainMemory {
  private dbPromise: Promise<Database>;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.dbPromise = this.init();
  }

  private async init(): Promise<Database> {
    const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: () => wasmPath,
    });
    const data = fs.existsSync(this.dbPath)
      ? new Uint8Array(fs.readFileSync(this.dbPath))
      : undefined;
    const db = new SQL.Database(data);
    db.run(`
      CREATE TABLE IF NOT EXISTS thesis (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        goal_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    return db;
  }

  private async persist(db: Database) {
    const data = db.export();
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  async saveState(userId: string, goalId: string, state: any) {
    const db = await this.dbPromise;
    const stmt = db.prepare(
      `INSERT INTO thesis (id, user_id, goal_id, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
    );
    stmt.run([
      `state-${userId}-${goalId}`,
      userId,
      goalId,
      JSON.stringify(state),
      Date.now(),
    ]);
    stmt.free();
    await this.persist(db);
  }

  async loadState(userId: string, goalId: string): Promise<any | null> {
    const db = await this.dbPromise;
    const stmt = db.prepare(
      `SELECT payload FROM thesis WHERE user_id = ? AND goal_id = ? ORDER BY updated_at DESC LIMIT 1`
    );
    stmt.bind([userId, goalId]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject() as { payload?: string };
    stmt.free();
    if (!row.payload) return null;
    return JSON.parse(row.payload);
  }
}

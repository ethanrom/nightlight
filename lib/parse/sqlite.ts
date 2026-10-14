// Browser history from the SQLite files Chrome/Edge/Brave/Opera/Vivaldi, Firefox and Safari keep on disk.
// Runs entirely in the browser (sql.js / WebAssembly) – the file never leaves the device.
import type { Database, SqlJsStatic } from "sql.js";
import type { ParsedHistory, SourceKind, Visit } from "../types";
import { COCOA_EPOCH_OFFSET_S, WEBKIT_EPOCH_OFFSET_MS, hasSqliteHeader, isIgnoredUrl } from "./util";

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** Lazily initialise sql.js (dynamic import keeps it out of the initial bundle). */
export function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = (async () => {
      const mod = (await import("sql.js")) as unknown as {
        default?: (config?: object) => Promise<SqlJsStatic>;
      } & ((config?: object) => Promise<SqlJsStatic>);
      const initSqlJs = typeof mod.default === "function" ? mod.default : mod;
      if (typeof window !== "undefined") {
        return initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
      }
      return initSqlJs();
    })().catch((err) => {
      sqlPromise = null; // allow a retry
      throw err;
    });
  }
  return sqlPromise;
}

const FRIENDLY_OPEN_ERROR =
  "We couldn't read this history file. Make sure it's the browser's own history file (Chrome/Edge: \"History\", Firefox: \"places.sqlite\", Safari: \"History.db\") and that it hasn't been renamed or opened in another program.";

/**
 * Databases in WAL mode have bytes 18 and 19 of the header set to 2, which sql.js can't open
 * without the -wal file. Flip them to 1 (rollback-journal mode) on a COPY of the buffer.
 */
export function fixWalHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 19 && (bytes[18] === 2 || bytes[19] === 2)) {
    const copy = new Uint8Array(bytes); // copies
    copy[18] = 1;
    copy[19] = 1;
    return copy;
  }
  return bytes;
}

type Row = Record<string, unknown>;

function* iterate(db: Database, sql: string): Generator<Row> {
  const stmt = db.prepare(sql);
  try {
    while (stmt.step()) yield stmt.getAsObject() as Row;
  } finally {
    stmt.free();
  }
}

function tableSet(db: Database): Set<string> {
  const names = new Set<string>();
  for (const r of iterate(db, "SELECT name FROM sqlite_master WHERE type IN ('table','view')")) {
    names.add(String(r.name));
  }
  return names;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : v == null ? NaN : Number(v);
}

function push(out: Visit[], url: unknown, title: unknown, ts: number) {
  if (typeof url !== "string" || isIgnoredUrl(url)) return;
  if (!Number.isFinite(ts) || ts <= 0) return;
  out.push({ url, title: typeof title === "string" ? title : "", ts: Math.round(ts) });
}

const webkitToMs = (t: number) => t / 1000 - WEBKIT_EPOCH_OFFSET_MS;
const firefoxToMs = (t: number) => t / 1000;
const safariToMs = (t: number) => (t + COCOA_EPOCH_OFFSET_S) * 1000;

function readChrome(db: Database): Visit[] {
  const out: Visit[] = [];
  const tables = tableSet(db);
  if (tables.has("visits")) {
    for (const r of iterate(
      db,
      "SELECT u.url AS url, u.title AS title, v.visit_time AS t FROM visits v JOIN urls u ON u.id = v.url",
    )) {
      push(out, r.url, r.title, webkitToMs(num(r.t)));
    }
  }
  if (out.length === 0) {
    // Some exports/cleaned profiles keep only the per-URL summary.
    for (const r of iterate(db, "SELECT url, title, last_visit_time AS t FROM urls WHERE last_visit_time > 0")) {
      push(out, r.url, r.title, webkitToMs(num(r.t)));
    }
  }
  return out;
}

function readFirefox(db: Database): Visit[] {
  const out: Visit[] = [];
  const tables = tableSet(db);
  if (tables.has("moz_historyvisits")) {
    for (const r of iterate(
      db,
      "SELECT p.url AS url, p.title AS title, h.visit_date AS t FROM moz_historyvisits h JOIN moz_places p ON p.id = h.place_id",
    )) {
      push(out, r.url, r.title, firefoxToMs(num(r.t)));
    }
  }
  if (out.length === 0) {
    for (const r of iterate(db, "SELECT url, title, last_visit_date AS t FROM moz_places WHERE last_visit_date > 0")) {
      push(out, r.url, r.title, firefoxToMs(num(r.t)));
    }
  }
  return out;
}

function readSafari(db: Database): Visit[] {
  const out: Visit[] = [];
  for (const r of iterate(
    db,
    "SELECT i.url AS url, v.title AS title, v.visit_time AS t FROM history_visits v JOIN history_items i ON i.id = v.history_item",
  )) {
    // Safari stores seconds since 2001-01-01 – only reject non-numbers.
    const t = num(r.t);
    if (!Number.isFinite(t)) continue;
    push(out, r.url, r.title, safariToMs(t));
  }
  return out;
}

function detectKind(tables: Set<string>): SourceKind | null {
  if (tables.has("moz_places")) return "firefox";
  if (tables.has("history_items") && tables.has("history_visits")) return "safari";
  if (tables.has("urls")) return "chrome";
  return null;
}

const LABELS: Record<string, string> = {
  chrome: "Chrome / Edge / Brave history",
  firefox: "Firefox history",
  safari: "Safari history",
};

/** Parse a browser History SQLite file (Chrome-family, Firefox or Safari). */
export async function parseSqliteHistory(bytes: Uint8Array): Promise<ParsedHistory> {
  if (!hasSqliteHeader(bytes)) throw new Error(FRIENDLY_OPEN_ERROR);
  const SQL = await getSql();
  let db: Database;
  try {
    db = new SQL.Database(fixWalHeader(bytes));
  } catch {
    throw new Error(FRIENDLY_OPEN_ERROR);
  }
  try {
    let kind: SourceKind | null;
    try {
      kind = detectKind(tableSet(db));
    } catch {
      throw new Error(FRIENDLY_OPEN_ERROR);
    }
    if (!kind) {
      throw new Error(
        "This database doesn't look like a browser history file. Chrome/Edge: \"History\", Firefox: \"places.sqlite\", Safari: \"History.db\".",
      );
    }
    let visits: Visit[];
    try {
      visits = kind === "firefox" ? readFirefox(db) : kind === "safari" ? readSafari(db) : readChrome(db);
    } catch {
      throw new Error(FRIENDLY_OPEN_ERROR);
    }
    visits.sort((a, b) => a.ts - b.ts);
    return { source: kind, label: LABELS[kind], visits };
  } finally {
    db.close();
  }
}

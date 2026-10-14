// Generates the synthetic demo data for "Maya" (14), Sep 22 – Oct 12, 2026.   Run: npm run samples
// Everything is fictional and seeded, so re-running produces byte-identical files on any machine.
// Timestamps are wall-clock times encoded as UTC; lib/pipeline.ts re-anchors them to the viewer's timezone.
//
// Writes:
//   public/samples/History                       Chrome-schema SQLite (built with sql.js)
//   public/samples/BrowserHistory.json           the SAME visits in Google Takeout format
//   public/samples/chatgpt-conversations.json    ChatGPT export format (with hidden system root, a regenerate branch...)
//   public/samples/characterai-transcript.txt    pasted-transcript style
//   tests/fixtures/places.sqlite                 Firefox schema, WAL header bytes (18/19 = 2)
//   tests/fixtures/History.db                    Safari schema
//   tests/fixtures/expected.json                 counts the tests assert against
import fs from "node:fs";
import path from "node:path";
import type { Database } from "sql.js";
import { getSql } from "../lib/parse/sqlite";
import { CHARACTERAI_TRANSCRIPT } from "./sample-data/characterai";
import { CONVERSATIONS, toChatGptExport } from "./sample-data/conversations";
import { generateHistory, type SampleVisit } from "./sample-data/history";

const ROOT = path.resolve(__dirname, "..");
const SAMPLES = path.join(ROOT, "public", "samples");
const FIXTURES = path.join(ROOT, "tests", "fixtures");

const WEBKIT_OFFSET_MS = 11_644_473_600_000;
const COCOA_OFFSET_S = 978_307_200;

const IGNORED = /^(chrome|about|edge|moz-extension|chrome-extension|file):/i;

function write(file: string, data: string | Uint8Array) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`  wrote ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

function searchTerm(url: string): { keywordId: number; term: string } | null {
  try {
    const u = new URL(url);
    if (/google\./.test(u.hostname) && u.pathname === "/search") return { keywordId: 2, term: u.searchParams.get("q") ?? "" };
    if (/youtube\.com$/.test(u.hostname) && u.pathname === "/results") return { keywordId: 3, term: u.searchParams.get("search_query") ?? "" };
    if (/pinterest\./.test(u.hostname) && u.pathname.startsWith("/search")) return { keywordId: 4, term: u.searchParams.get("q") ?? "" };
  } catch {
    /* not a URL */
  }
  return null;
}

// ---------------------------------------------------------------- Chrome

async function buildChrome(visits: SampleVisit[], extra: SampleVisit[] = []): Promise<Uint8Array> {
  const SQL = await getSql();
  const db: Database = new SQL.Database();
  db.run(`
    CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR);
    CREATE TABLE urls(id INTEGER PRIMARY KEY AUTOINCREMENT, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER DEFAULT 0 NOT NULL, typed_count INTEGER DEFAULT 0 NOT NULL, last_visit_time INTEGER NOT NULL, hidden INTEGER DEFAULT 0 NOT NULL);
    CREATE TABLE visits(id INTEGER PRIMARY KEY, url INTEGER NOT NULL, visit_time INTEGER NOT NULL, from_visit INTEGER, transition INTEGER DEFAULT 0 NOT NULL, segment_id INTEGER, visit_duration INTEGER DEFAULT 0 NOT NULL, incremented_omnibox_typed_score BOOLEAN DEFAULT FALSE NOT NULL);
    CREATE TABLE keyword_search_terms(keyword_id INTEGER NOT NULL, url_id INTEGER NOT NULL, term LONGVARCHAR NOT NULL, normalized_term LONGVARCHAR NOT NULL);
    CREATE INDEX urls_url_index ON urls (url);
    CREATE INDEX visits_url_index ON visits (url);
    CREATE INDEX visits_time_index ON visits (visit_time);
    INSERT INTO meta VALUES ('version','70'), ('last_compatible_version','16');
  `);
  const all = [...visits, ...extra].sort((a, b) => a.ts - b.ts);
  const agg = new Map<string, { id: number; title: string; count: number; last: number }>();
  for (const v of all) {
    const a = agg.get(v.url);
    if (a) {
      a.count++;
      a.last = Math.max(a.last, v.ts);
    } else {
      agg.set(v.url, { id: agg.size + 1, title: v.title, count: 1, last: v.ts });
    }
  }
  const toWebkit = (ts: number) => (ts + WEBKIT_OFFSET_MS) * 1000;
  db.run("BEGIN");
  const insUrl = db.prepare("INSERT INTO urls (id,url,title,visit_count,typed_count,last_visit_time,hidden) VALUES (?,?,?,?,?,?,0)");
  for (const [url, a] of agg) insUrl.run([a.id, url, a.title, a.count, 0, toWebkit(a.last)]);
  insUrl.free();
  const insVisit = db.prepare("INSERT INTO visits (id,url,visit_time,from_visit,transition,segment_id,visit_duration) VALUES (?,?,?,?,?,?,?)");
  let vid = 0;
  for (const v of all) {
    vid++;
    insVisit.run([vid, agg.get(v.url)!.id, toWebkit(v.ts), 0, 805306368, 0, (v.ts % 97) * 1_000_000]);
  }
  insVisit.free();
  const insTerm = db.prepare("INSERT INTO keyword_search_terms (keyword_id,url_id,term,normalized_term) VALUES (?,?,?,?)");
  for (const [url, a] of agg) {
    const s = searchTerm(url);
    if (s && s.term) insTerm.run([s.keywordId, a.id, s.term, s.term.toLowerCase()]);
  }
  insTerm.free();
  db.run("COMMIT");
  const bytes = db.export();
  db.close();
  return bytes;
}

// ---------------------------------------------------------------- Takeout

function buildTakeout(visits: SampleVisit[]): string {
  const rows = [...visits]
    .sort((a, b) => b.ts - a.ts) // Takeout lists newest first
    .map((v) => ({
      favicon_url: `https://${new URL(v.url).hostname}/favicon.ico`,
      page_transition: "LINK",
      title: v.title,
      url: v.url,
      client_id: "nightlight-demo-client==",
      time_usec: v.ts * 1000,
    }));
  return JSON.stringify({ "Browser History": rows }, null, 2);
}

// ---------------------------------------------------------------- Firefox / Safari fixtures

/** Every n-th visit so the fixtures stay small but cover the whole date range. */
function subset(visits: SampleVisit[], count: number): SampleVisit[] {
  const stride = Math.max(1, Math.floor(visits.length / count));
  const out: SampleVisit[] = [];
  for (let i = 0; i < visits.length && out.length < count; i += stride) out.push(visits[i]);
  return out;
}

async function buildFirefox(visits: SampleVisit[]): Promise<Uint8Array> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR, title LONGVARCHAR, rev_host LONGVARCHAR, visit_count INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0 NOT NULL, typed INTEGER DEFAULT 0 NOT NULL, frecency INTEGER DEFAULT -1 NOT NULL, last_visit_date INTEGER, guid TEXT, foreign_count INTEGER DEFAULT 0 NOT NULL, url_hash INTEGER DEFAULT 0 NOT NULL, description TEXT, preview_image_url TEXT, origin_id INTEGER, site_name TEXT);
    CREATE TABLE moz_historyvisits (id INTEGER PRIMARY KEY, from_visit INTEGER, place_id INTEGER, visit_date INTEGER, visit_type INTEGER, session INTEGER);
    CREATE INDEX moz_historyvisits_placedateindex ON moz_historyvisits (place_id, visit_date);
  `);
  // Two internal pages that must be ignored.
  const internal: SampleVisit[] = [
    { url: "about:preferences", title: "Settings", ts: visits[0].ts + 1000 },
    { url: "moz-extension://5d1f-aa/options.html", title: "Extension options", ts: visits[0].ts + 2000 },
  ];
  const all = [...visits, ...internal].sort((a, b) => a.ts - b.ts);
  const places = new Map<string, { id: number; title: string | null; count: number; last: number }>();
  all.forEach((v, i) => {
    const p = places.get(v.url);
    if (p) {
      p.count++;
      p.last = Math.max(p.last, v.ts);
    } else {
      places.set(v.url, { id: places.size + 1, title: i % 17 === 5 ? null : v.title, count: 1, last: v.ts });
    }
  });
  db.run("BEGIN");
  for (const [url, p] of places) {
    db.run("INSERT INTO moz_places (id,url,title,visit_count,last_visit_date,guid) VALUES (?,?,?,?,?,?)", [
      p.id,
      url,
      p.title,
      p.count,
      p.last * 1000,
      `g${p.id}`.padEnd(12, "x"),
    ]);
  }
  all.forEach((v, i) => {
    db.run("INSERT INTO moz_historyvisits (id,from_visit,place_id,visit_date,visit_type,session) VALUES (?,?,?,?,?,?)", [
      i + 1,
      0,
      places.get(v.url)!.id,
      v.ts * 1000,
      1,
      0,
    ]);
  });
  db.run("COMMIT");
  const bytes = db.export();
  db.close();
  // Real places.sqlite files are in WAL mode: header bytes 18 and 19 are 2. sql.js can't open those as-is.
  bytes[18] = 2;
  bytes[19] = 2;
  return bytes;
}

async function buildSafari(visits: SampleVisit[]): Promise<Uint8Array> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE history_items (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, url TEXT NOT NULL UNIQUE, domain_expansion TEXT NULL, visit_count INTEGER NOT NULL, daily_visit_counts BLOB NOT NULL, weekly_visit_counts BLOB NULL, autocomplete_triggers BLOB NULL, should_recompute_derived_visit_counts INTEGER NOT NULL, visit_count_score INTEGER NOT NULL, status_code INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE history_visits (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, history_item INTEGER NOT NULL REFERENCES history_items(id) ON DELETE CASCADE, visit_time REAL NOT NULL, title TEXT NULL, load_successful BOOLEAN NOT NULL DEFAULT 1, http_non_get BOOLEAN NOT NULL DEFAULT 0, synthesized BOOLEAN NOT NULL DEFAULT 0, redirect_source INTEGER NULL, redirect_destination INTEGER NULL, origin INTEGER NOT NULL DEFAULT 0, generation INTEGER NOT NULL DEFAULT 0, attributes INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0);
  `);
  const items = new Map<string, { id: number; count: number }>();
  for (const v of visits) {
    const it = items.get(v.url);
    if (it) it.count++;
    else items.set(v.url, { id: items.size + 1, count: 1 });
  }
  db.run("BEGIN");
  for (const [url, it] of items) {
    db.run(
      "INSERT INTO history_items (id,url,domain_expansion,visit_count,daily_visit_counts,should_recompute_derived_visit_counts,visit_count_score) VALUES (?,?,NULL,?,x'',0,100)",
      [it.id, url, it.count],
    );
  }
  visits.forEach((v, i) => {
    db.run("INSERT INTO history_visits (history_item,visit_time,title) VALUES (?,?,?)", [
      items.get(v.url)!.id,
      v.ts / 1000 - COCOA_OFFSET_S,
      i % 13 === 4 ? null : v.title,
    ]);
  });
  db.run("COMMIT");
  const bytes = db.export();
  db.close();
  return bytes;
}

// ---------------------------------------------------------------- main

/** The samples encode wall-clock times as UTC (see sample-data/util.ts), so read them back as UTC. */
function wallDay(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

async function main() {
  console.log("Generating Nightlight demo data for Maya (14), Sep 22 – Oct 12, 2026 ...");
  const { visits } = generateHistory();
  const clean = visits.filter((v) => !IGNORED.test(v.url));

  // Chrome History + a few internal pages that the parser must skip (and which are NOT in the Takeout file)
  const internalChrome: SampleVisit[] = [
    { url: "chrome://newtab/", title: "New Tab", ts: clean[0].ts - 60_000 },
    { url: "chrome://settings/", title: "Settings", ts: clean[0].ts - 30_000 },
  ];
  const chromeBytes = await buildChrome(clean, internalChrome);
  write(path.join(SAMPLES, "History"), chromeBytes);
  write(path.join(SAMPLES, "BrowserHistory.json"), buildTakeout(clean));
  write(path.join(SAMPLES, "chatgpt-conversations.json"), JSON.stringify(toChatGptExport()));
  write(path.join(SAMPLES, "characterai-transcript.txt"), CHARACTERAI_TRANSCRIPT);

  const ffVisits = subset(clean, 60);
  const safariVisits = subset(clean, 40);
  write(path.join(FIXTURES, "places.sqlite"), await buildFirefox(ffVisits));
  write(path.join(FIXTURES, "History.db"), await buildSafari(safariVisits));

  const expected = {
    chrome: {
      visits: clean.length,
      uniqueUrls: new Set(clean.map((v) => v.url)).size,
      firstTs: clean[0].ts,
      lastTs: clean[clean.length - 1].ts,
    },
    takeout: { visits: clean.length },
    firefox: { visits: ffVisits.length, firstUrl: ffVisits[0].url, firstTs: ffVisits[0].ts },
    safari: { visits: safariVisits.length, firstUrl: safariVisits[0].url, firstTs: safariVisits[0].ts },
    chatgpt: { conversations: CONVERSATIONS.length },
  };
  write(path.join(FIXTURES, "expected.json"), JSON.stringify(expected, null, 2));

  // ---- stats
  const domains = new Set(clean.map((v) => new URL(v.url).hostname.replace(/^www\./, "")));
  const uniquePages = new Set(clean.map((v) => {
    const u = new URL(v.url);
    return `${u.hostname}${u.pathname}|${u.pathname === "/search" || u.pathname === "/results" ? u.search : ""}|${v.title}`;
  }));
  const lateByDay = new Map<string, number>();
  let late = 0;
  for (const v of clean) {
    if (new Date(v.ts).getUTCHours() < 5) {
      late++;
      lateByDay.set(wallDay(v.ts), (lateByDay.get(wallDay(v.ts)) ?? 0) + 1);
    }
  }
  console.log("\nSample data stats");
  console.log(`  visits:            ${clean.length}`);
  console.log(`  unique URLs:       ${expected.chrome.uniqueUrls}`);
  console.log(`  unique pages:      ${uniquePages.size}  (domain+path+query-for-searches+title)`);
  console.log(`  domains:           ${domains.size}`);
  console.log(`  late-night visits: ${late} (${((late / clean.length) * 100).toFixed(1)}%)`);
  console.log(`  late-night by day: ${[...lateByDay.entries()].sort().map(([d, n]) => `${d.slice(5)}:${n}`).join(" ")}`);
  console.log(`  range:             ${new Date(clean[0].ts).toISOString().slice(0, 16)} -> ${new Date(clean[clean.length - 1].ts).toISOString().slice(0, 16)}`);
  console.log(`  ChatGPT convs:     ${CONVERSATIONS.length}`);
  console.log(`  Character.AI:      ${CHARACTERAI_TRANSCRIPT.split("\n").filter((l) => /^(Kai|Maya):/.test(l)).length} lines`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

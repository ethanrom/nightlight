// Generic CSV export (e.g. from a history-export browser extension). Auto-detects url / title / time columns.
import Papa from "papaparse";
import type { ParsedHistory, Visit } from "../types";
import { isIgnoredUrl, toMs } from "./util";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const URL_NAMES = ["url", "link", "uri", "address", "pageurl", "href", "website", "site"];
const TITLE_NAMES = ["title", "pagetitle", "name", "pagename"];
const TIME_NAMES = [
  "visittime",
  "lastvisittime",
  "lastvisitdate",
  "lastvisited",
  "visitdate",
  "visitedat",
  "visited",
  "lastvisit",
  "time",
  "date",
  "datetime",
  "timestamp",
  "timeutc",
  "visittimeutc",
  "when",
];

function pick(headers: string[], candidates: string[]): string | undefined {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  for (const c of candidates) {
    const hit = byNorm.get(c);
    if (hit) return hit;
  }
  // Looser: the header merely contains the candidate (e.g. "Visit Time (UTC) – local").
  for (const c of candidates) {
    for (const [n, h] of byNorm) if (n.includes(c)) return h;
  }
  return undefined;
}

export function detectCsvColumns(headers: string[]) {
  return {
    url: pick(headers, URL_NAMES),
    title: pick(headers, TITLE_NAMES),
    time: pick(headers, TIME_NAMES),
  };
}

/** Cheap check used by the sniffer: does the first line look like a CSV header with a url column? */
export function looksLikeHistoryCsv(text: string): boolean {
  const firstLine = text.slice(0, 4000).split(/\r?\n/, 1)[0] ?? "";
  const parsed = Papa.parse<string[]>(firstLine, { header: false });
  const headers = (parsed.data[0] ?? []).map(String);
  return headers.some((h) => URL_NAMES.includes(norm(h)));
}

export function parseCsv(text: string): ParsedHistory {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const headers = parsed.meta.fields ?? [];
  const cols = detectCsvColumns(headers);
  if (!cols.url) {
    throw new Error(
      "We couldn't find a URL column in this CSV. It needs a column called \"url\" (and ideally \"title\" and a visit time).",
    );
  }
  if (!cols.time) {
    throw new Error(
      "We found the URLs in this CSV but no visit time column (e.g. \"visitTime\", \"lastVisitTime\", \"date\" or \"timestamp\"). Nightlight needs the time to spot late-night activity.",
    );
  }
  const visits: Visit[] = [];
  for (const row of parsed.data) {
    const url = (row[cols.url] ?? "").trim();
    if (isIgnoredUrl(url)) continue;
    const ts = toMs(row[cols.time]);
    if (ts == null) continue;
    visits.push({ url, title: cols.title ? (row[cols.title] ?? "").trim() : "", ts });
  }
  if (visits.length === 0) {
    throw new Error("We couldn't read any visits from this CSV – the time column didn't look like dates or timestamps.");
  }
  visits.sort((a, b) => a.ts - b.ts);
  return { source: "csv", label: "CSV history", visits };
}

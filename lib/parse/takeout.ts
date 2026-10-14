// Google Takeout "BrowserHistory.json" / "History.json": {"Browser History":[{title,url,time_usec,...}]}
import type { ParsedHistory, Visit } from "../types";
import { isIgnoredUrl, toMs } from "./util";

const BAD_FILE = "This doesn't look like a Google Takeout Chrome history file (BrowserHistory.json).";

export function isTakeoutShape(json: unknown): boolean {
  if (Array.isArray(json)) {
    const first = json.find((x) => x && typeof x === "object") as Record<string, unknown> | undefined;
    return !!first && typeof first.url === "string" && "time_usec" in first;
  }
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    return Array.isArray(o["Browser History"]) || Array.isArray(o["Browser-History"]);
  }
  return false;
}

export function parseTakeoutJson(json: unknown): ParsedHistory {
  let entries: unknown;
  if (Array.isArray(json)) entries = json;
  else if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    entries = o["Browser History"] ?? o["Browser-History"];
  }
  if (!Array.isArray(entries)) throw new Error(BAD_FILE);

  const visits: Visit[] = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url : "";
    if (isIgnoredUrl(url)) continue;
    // time_usec is microseconds since the Unix epoch (sometimes serialised as a string).
    const ts = toMs(r.time_usec ?? r.time ?? r.timestamp);
    if (ts == null) continue;
    visits.push({ url, title: typeof r.title === "string" ? r.title : "", ts });
  }
  visits.sort((a, b) => a.ts - b.ts);
  return { source: "takeout", label: "Google Takeout history", visits };
}

export function parseTakeout(text: string): ParsedHistory {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(BAD_FILE);
  }
  return parseTakeoutJson(json);
}

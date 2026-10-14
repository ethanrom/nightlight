import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../lib/parse/csv";
import { fixWalHeader, parseSqliteHistory } from "../lib/parse/sqlite";
import { parseTakeout } from "../lib/parse/takeout";
import { FIXTURES, SAMPLES, expected, readBytes, readText } from "./helpers";

const START = new Date(2026, 8, 22).getTime(); // Sep 22 2026 (local)
const END = new Date(2026, 9, 13).getTime(); // Oct 13 2026 (local)

describe("Chrome / Edge / Brave History (sqlite)", () => {
  it("parses the sample History file", async () => {
    const h = await parseSqliteHistory(readBytes(path.join(SAMPLES, "History")));
    expect(h.source).toBe("chrome");
    expect(h.visits.length).toBeGreaterThan(1000);
    expect(h.visits.length).toBe(expected().chrome.visits);
    for (const v of h.visits) {
      expect(v.ts).toBeGreaterThanOrEqual(START);
      expect(v.ts).toBeLessThan(END);
      expect(typeof v.title).toBe("string");
    }
    // sorted oldest -> newest
    for (let i = 1; i < h.visits.length; i++) expect(h.visits[i].ts).toBeGreaterThanOrEqual(h.visits[i - 1].ts);
  });

  it("skips chrome:// and other internal pages", async () => {
    const h = await parseSqliteHistory(readBytes(path.join(SAMPLES, "History")));
    expect(h.visits.some((v) => /^(chrome|about|edge|file|moz-extension|chrome-extension):/i.test(v.url))).toBe(false);
  });

  it("converts WebKit timestamps correctly (first visit)", async () => {
    const h = await parseSqliteHistory(readBytes(path.join(SAMPLES, "History")));
    expect(h.visits[0].ts).toBe(expected().chrome.firstTs);
    expect(h.visits[h.visits.length - 1].ts).toBe(expected().chrome.lastTs);
  });

  it("contains the planted late-night search with its exact title", async () => {
    const h = await parseSqliteHistory(readBytes(path.join(SAMPLES, "History")));
    const burden = h.visits.find((v) => v.title === "i feel like a burden to everyone - Google Search");
    expect(burden).toBeTruthy();
    const d = new Date(burden!.ts);
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([9, 10, 1, 40]);
  });

  it("rejects non-sqlite and non-browser databases with a friendly error", async () => {
    await expect(parseSqliteHistory(new TextEncoder().encode("hello"))).rejects.toThrow(/couldn't read/i);
  });
});

describe("Google Takeout BrowserHistory.json", () => {
  it("yields the same visits as the Chrome file", async () => {
    const chrome = await parseSqliteHistory(readBytes(path.join(SAMPLES, "History")));
    const takeout = parseTakeout(readText(path.join(SAMPLES, "BrowserHistory.json")));
    expect(takeout.source).toBe("takeout");
    expect(takeout.visits.length).toBe(chrome.visits.length);
    expect(takeout.visits.length).toBe(expected().takeout.visits);
    expect(takeout.visits.map((v) => v.ts)).toEqual(chrome.visits.map((v) => v.ts));
    expect(new Set(takeout.visits.map((v) => v.url))).toEqual(new Set(chrome.visits.map((v) => v.url)));
  });

  it("handles time_usec given as a string and drops internal URLs", () => {
    const t = parseTakeout(
      JSON.stringify({
        "Browser History": [
          { title: "A", url: "https://a.example/", time_usec: "1790040500521000" },
          { title: "New tab", url: "chrome://newtab/", time_usec: 1790040500521000 },
        ],
      }),
    );
    expect(t.visits).toEqual([{ title: "A", url: "https://a.example/", ts: 1790040500521 }]);
  });
});

describe("Firefox places.sqlite", () => {
  it("opens a WAL-mode file (header bytes 18/19 = 2) and parses it", async () => {
    const bytes = readBytes(path.join(FIXTURES, "places.sqlite"));
    expect(bytes[18]).toBe(2);
    expect(bytes[19]).toBe(2);
    const before = Uint8Array.from(bytes);
    const h = await parseSqliteHistory(bytes);
    expect(h.source).toBe("firefox");
    expect(h.visits.length).toBe(expected().firefox.visits);
    expect(h.visits[0].url).toBe(expected().firefox.firstUrl);
    expect(h.visits[0].ts).toBe(expected().firefox.firstTs);
    expect(h.visits.some((v) => v.url.startsWith("about:") || v.url.startsWith("moz-extension:"))).toBe(false);
    // the caller's buffer must not be modified – we patch a copy
    expect(Array.from(bytes.subarray(0, 100))).toEqual(Array.from(before.subarray(0, 100)));
  });

  it("fixWalHeader only touches a copy", () => {
    const a = new Uint8Array(100);
    a[18] = 2;
    a[19] = 2;
    const b = fixWalHeader(a);
    expect(b).not.toBe(a);
    expect([b[18], b[19]]).toEqual([1, 1]);
    expect([a[18], a[19]]).toEqual([2, 2]);
    const c = new Uint8Array(100);
    expect(fixWalHeader(c)).toBe(c);
  });
});

describe("Safari History.db", () => {
  it("parses visits (seconds since 2001) and keeps null titles as empty strings", async () => {
    const h = await parseSqliteHistory(readBytes(path.join(FIXTURES, "History.db")));
    expect(h.source).toBe("safari");
    expect(h.visits.length).toBe(expected().safari.visits);
    expect(h.visits[0].url).toBe(expected().safari.firstUrl);
    expect(Math.abs(h.visits[0].ts - expected().safari.firstTs)).toBeLessThanOrEqual(1);
    expect(h.visits.some((v) => v.title === "")).toBe(true);
    for (const v of h.visits) {
      expect(v.ts).toBeGreaterThanOrEqual(START);
      expect(v.ts).toBeLessThan(END);
    }
  });
});

describe("generic CSV", () => {
  it("detects url / title / ISO time columns case-insensitively", () => {
    const csv = ["Title,URL,Visit Time", '"Khan Academy, algebra",https://www.khanacademy.org/math/algebra,2026-10-05T16:20:00', "Home,chrome://newtab/,2026-10-05T16:21:00"].join("\n");
    const h = parseCsv(csv);
    expect(h.source).toBe("csv");
    expect(h.visits).toHaveLength(1);
    expect(h.visits[0].title).toBe("Khan Academy, algebra");
    expect(h.visits[0].ts).toBe(new Date(2026, 9, 5, 16, 20, 0).getTime());
  });

  it("accepts epoch seconds and milliseconds", () => {
    const sec = parseCsv("url,title,timestamp\nhttps://a.example/,A,1790040500\n");
    const ms = parseCsv("url,title,lastVisitTime\nhttps://a.example/,A,1790040500521\n");
    expect(sec.visits[0].ts).toBe(1790040500000);
    expect(ms.visits[0].ts).toBe(1790040500521);
  });

  it("accepts WebKit microseconds (Chrome exports)", () => {
    const webkit = (1790040500521 + 11644473600000) * 1000;
    const h = parseCsv(`url,title,visitTime\nhttps://a.example/,A,${webkit}\n`);
    expect(h.visits[0].ts).toBe(1790040500521);
  });

  it("explains what is missing", () => {
    expect(() => parseCsv("name,age\nA,1\n")).toThrow(/URL column/);
    expect(() => parseCsv("url,title\nhttps://a.example/,A\n")).toThrow(/time/i);
  });
});

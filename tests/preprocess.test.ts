import path from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_AI_APPS, matchAiApp } from "../lib/ai-apps";
import { parseFile } from "../lib/parse";
import { analyzeUrl, prepare } from "../lib/preprocess";
import type { Conversation, ParsedFile, Visit } from "../lib/types";
import { SAMPLES, readBytes } from "./helpers";

const history = (visits: Visit[], source: "chrome" | "takeout" = "chrome"): ParsedFile => ({
  kind: "history",
  fileName: "h",
  data: { source, label: "test", visits },
});

describe("search extraction & url normalisation", () => {
  const ts = new Date(2026, 9, 5, 16, 0, 0).getTime();
  const cases: [string, string, string][] = [
    ["https://www.google.com/search?q=how+to+lose+5kg&oq=how&sourceid=chrome", "google.com", "how to lose 5kg"],
    ["https://www.google.co.uk/search?q=bbc%20bitesize", "google.co.uk", "bbc bitesize"],
    ["https://www.bing.com/search?q=quadratic+formula&form=QBLH", "bing.com", "quadratic formula"],
    ["https://duckduckgo.com/?q=private+browser&ia=web", "duckduckgo.com", "private browser"],
    ["https://www.youtube.com/results?search_query=lofi+beats", "youtube.com", "lofi beats"],
    ["https://www.tiktok.com/search?q=dance%20trend", "tiktok.com", "dance trend"],
    ["https://search.yahoo.com/search?p=cheap+flights&fr=yfp", "search.yahoo.com", "cheap flights"],
    ["https://www.ecosia.org/search?q=plant+a+tree", "ecosia.org", "plant a tree"],
    ["https://www.pinterest.com/search/pins/?q=thinspo%20legs&rs=typed", "pinterest.com", "thinspo legs"],
    ["https://www.reddit.com/search?q=minecraft+seeds", "reddit.com", "minecraft seeds"],
    ["https://www.reddit.com/search/?q=minecraft+seeds&type=link", "reddit.com", "minecraft seeds"],
  ];

  it.each(cases)("%s", (url, domain, search) => {
    const info = analyzeUrl(url)!;
    expect(info.domain).toBe(domain);
    expect(info.search).toBe(search);
    const p = prepare([history([{ url, title: "t", ts }])]);
    expect(p.historyItems).toHaveLength(1);
    expect(p.historyItems[0].search).toBe(search);
    expect(p.stats.searchCount).toBe(1);
  });

  it("does not treat ordinary pages as searches and strips query/fragment/www", () => {
    const info = analyzeUrl("https://www.khanacademy.org/math/algebra/?utm_source=x&q=hello#section")!;
    expect(info).toEqual({ domain: "khanacademy.org", path: "/math/algebra" });
    expect(analyzeUrl("https://www.google.com/maps?q=cafe")!.search).toBeUndefined();
    expect(analyzeUrl("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit")!.path).toBe("/document/d/:id/edit");
    expect(analyzeUrl("not a url")).toBeNull();
    expect(analyzeUrl("ftp://example.com/x")).toBeNull();
  });

  it("dedupes by domain+path+title (searches by domain+query), counts visits, and finds late-night visits", () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
    const p = prepare([
      history([
        { url: "https://www.chess.com/play/online?ref=1", title: "Play Chess Online", ts: at(1, 10) },
        { url: "https://chess.com/play/online#x", title: "Play Chess Online", ts: at(4, 59) },
        { url: "https://chess.com/play/online/", title: "Play Chess Online", ts: at(5, 0) },
        { url: "https://chess.com/play/online", title: "Different title", ts: at(12) },
        { url: "https://www.google.com/search?q=Hello+World", title: "Hello World - Google Search", ts: at(13) },
        { url: "https://www.google.com/search?q=hello+world&oq=he", title: "hello world - Google Search", ts: at(14) },
        { url: "https://www.youtube.com/watch?v=abc", title: "(3) A video - YouTube", ts: at(15) },
        { url: "https://www.youtube.com/watch?v=xyz", title: "A video - YouTube", ts: at(16) },
        { url: "chrome://newtab/", title: "New tab", ts: at(17) },
      ]),
    ]);
    const chess = p.historyItems.find((i) => i.title === "Play Chess Online")!;
    expect(chess.visits).toBe(3);
    expect(chess.lateNight).toBe(2); // 01:10 and 04:59 are late night, 05:00 is not
    expect(chess.firstSeen).toBe(at(1, 10));
    expect(chess.lastSeen).toBe(at(5, 0));
    expect(chess.domain).toBe("chess.com");
    expect(chess.path).toBe("/play/online");
    expect(p.historyItems.filter((i) => i.search)).toHaveLength(1);
    expect(p.historyItems.find((i) => i.search)!.visits).toBe(2);
    expect(p.historyItems.find((i) => i.title === "A video - YouTube")!.visits).toBe(2); // "(3) " counter stripped
    expect(p.historyItems).toHaveLength(4); // chess x2 titles, one search, one video
    expect(p.stats.totalVisits).toBe(8);
    expect(p.stats.uniquePages).toBe(4);
    expect(p.stats.uniqueDomains).toBe(3);
    expect(p.historyItems.map((i) => i.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("redacts page titles and search queries", () => {
    const ts = Date.now();
    const p = prepare([
      history([
        { url: "https://mail.google.com/mail/u/0/#inbox", title: "Inbox - maya.k.2012@gmail.com - Gmail", ts },
        { url: "https://www.google.com/search?q=call+07911+123456", title: "call 07911 123456 - Google Search", ts },
      ]),
    ]);
    expect(p.historyItems.map((i) => i.title).join("|")).not.toMatch(/gmail\.com|07911/);
    expect(p.historyItems.find((i) => i.search)!.search).toBe("call [PHONE]");
  });
});

describe("matchAiApp", () => {
  it("knows the required apps and matches subdomains", () => {
    for (const d of [
      "chatgpt.com", "chat.openai.com", "gemini.google.com", "claude.ai", "perplexity.ai", "copilot.microsoft.com", "meta.ai", "poe.com",
      "character.ai", "c.ai", "replika.com", "janitorai.com", "chai.ml", "talkie-ai.com", "polybuzz.ai", "crushon.ai", "nomi.ai", "kindroid.ai",
    ]) {
      expect(KNOWN_AI_APPS.some((a) => a.domain === d), d).toBe(true);
      expect(matchAiApp(d)?.domain).toBe(d);
    }
    expect(matchAiApp("beta.character.ai")?.name).toBe("Character.AI");
    expect(matchAiApp("www.chatgpt.com")?.name).toBe("ChatGPT");
    expect(matchAiApp("my.replika.com")?.kind).toBe("ai_companion");
    expect(matchAiApp("abc.ai")).toBeUndefined();
    expect(matchAiApp("notchatgpt.com")).toBeUndefined();
    expect(matchAiApp("google.com")).toBeUndefined();
  });
});

describe("prepare() on the demo data", async () => {
  const [chrome, chats, transcript] = await Promise.all([
    parseFile("History", readBytes(path.join(SAMPLES, "History"))),
    parseFile("conversations.json", readBytes(path.join(SAMPLES, "chatgpt-conversations.json"))),
    parseFile("characterai-transcript.txt", readBytes(path.join(SAMPLES, "characterai-transcript.txt"))),
  ]);
  const prepared = prepare([chrome, chats, transcript]);
  const { stats } = prepared;

  it("computes LocalStats", () => {
    expect(stats.totalVisits).toBeGreaterThan(1000);
    expect(stats.uniquePages).toBeGreaterThan(300);
    expect(stats.uniquePages).toBeLessThan(500);
    expect(stats.uniqueDomains).toBeGreaterThanOrEqual(35);
    expect(stats.searchCount).toBeGreaterThan(40);
    expect(stats.range!.start).toBeLessThan(stats.range!.end);
    expect(stats.heatmap).toHaveLength(7);
    for (const row of stats.heatmap) expect(row).toHaveLength(24);
    const heatTotal = stats.heatmap.flat().reduce((a, b) => a + b, 0);
    // history visits + child chat messages that have a timestamp (the pasted transcript has none)
    const datedChildMessages = chats.kind === "chats"
      ? chats.data.conversations.reduce((n, c) => n + c.messages.filter((m) => m.role === "child" && m.ts != null).length, 0)
      : 0;
    expect(heatTotal).toBe(stats.totalVisits + datedChildMessages);
    expect(stats.lateNightShare).toBeGreaterThan(0.05);
    expect(stats.lateNightShare).toBeLessThan(0.5);
    expect(stats.topDomains).toHaveLength(10);
    expect(stats.topDomains[0].visits).toBeGreaterThanOrEqual(stats.topDomains[9].visits);
    expect(stats.conversations).toBe(16);
    expect(stats.childMessages).toBeGreaterThan(40);
    expect(stats.analysed).toEqual({
      historyItems: stats.uniquePages,
      historyTotal: stats.uniquePages,
      conversations: 16,
      conversationsTotal: 16,
    });
  });

  it("aiApps includes character.ai and chatgpt.com, with late-night counts", () => {
    const names = stats.aiApps.map((a) => a.domain);
    expect(names).toContain("character.ai");
    expect(names).toContain("chatgpt.com");
    const cai = stats.aiApps.find((a) => a.domain === "character.ai")!;
    expect(cai.kind).toBe("ai_companion");
    expect(cai.visits).toBeGreaterThan(50);
    expect(cai.lateNight).toBeGreaterThan(30);
    expect(cai.lateNight).toBeLessThanOrEqual(cai.visits);
  });

  it("perDay is sorted, local and consistent with the heatmap", () => {
    const dates = stats.perDay.map((d) => d.date);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0]).toBe("2026-09-22");
    expect(dates[dates.length - 1]).toBe("2026-10-12");
    expect(stats.perDay.reduce((n, d) => n + d.visits, 0)).toBe(stats.heatmap.flat().reduce((a, b) => a + b, 0));
    const late = stats.perDay.reduce((n, d) => n + d.lateNight, 0);
    const heatLate = stats.heatmap.reduce((n, row) => n + row.slice(0, 5).reduce((a, b) => a + b, 0), 0);
    expect(late).toBe(heatLate);
    // late-night activity grows over the last 10 days
    const early = stats.perDay.filter((d) => d.date < "2026-10-03").reduce((n, d) => n + d.lateNight, 0);
    const lateWeek = stats.perDay.filter((d) => d.date >= "2026-10-06").reduce((n, d) => n + d.lateNight, 0);
    expect(lateWeek).toBeGreaterThan(early * 3);
  });

  it("puts Monday at index 0 of the heatmap", () => {
    const monday10am = new Date(2026, 9, 12, 10, 0).getTime(); // Mon Oct 12 2026
    const sunday2300 = new Date(2026, 9, 11, 23, 0).getTime();
    const p = prepare([history([{ url: "https://a.example/", title: "a", ts: monday10am }, { url: "https://a.example/", title: "a", ts: sunday2300 }])]);
    expect(p.stats.heatmap[0][10]).toBe(1);
    expect(p.stats.heatmap[6][23]).toBe(1);
  });

  it("extracts the planted searches and keeps late-night info", () => {
    const find = (s: string) => prepared.historyItems.find((i) => i.search === s);
    expect(find("how to lose 5kg in 2 weeks")).toBeTruthy();
    expect(find("what to eat to lose weight fast before a dance")).toBeTruthy();
    expect(find("thinspo legs")!.domain).toBe("pinterest.com");
    expect(find("how to hide apps on iphone from parents")).toBeTruthy();
    expect(find("where to buy vape without id")).toBeTruthy();
    const burden = find("i feel like a burden to everyone")!;
    expect(burden.lateNight).toBe(1);
    expect(new Date(burden.lastSeen).getHours()).toBe(1);
    const nudify = prepared.historyItems.find((i) => i.domain === "pixstrip-ai.example")!;
    expect(nudify.title).toBe("PixStrip AI – Undress any photo free");
    expect(nudify.visits).toBe(2);
    const kai = prepared.historyItems.find((i) => i.title === "Chat with Kai 💜 | character.ai")!;
    expect(kai.visits).toBeGreaterThan(50);
    expect(kai.lateNight).toBeGreaterThan(30);
  });

  it("prepares conversations newest first, with redaction and sequential message indexes", () => {
    const convs = prepared.conversations;
    expect(convs).toHaveLength(16);
    const starts = convs.map((c) => c.startedAt ?? 0);
    // transcripts have no date and sort last; everything else is newest first
    const dated = starts.filter((s) => s > 0);
    expect([...dated].sort((a, b) => b - a)).toEqual(dated);
    expect(convs[0].title).toBe("Just need to talk");
    expect(convs[convs.length - 1].platform).toBe("Character.AI");
    for (const c of convs) {
      c.messages.forEach((m, i) => expect(m.i).toBe(i));
    }
    // only the conversation where ChatGPT wrote a whole essay has a message long enough to be shortened
    expect(convs.filter((c) => c.truncated).map((c) => c.title)).toEqual(["Essay on To Kill a Mockingbird"]);
    expect(prepared.sources.map((s) => [s.kind, s.count])).toEqual([
      ["chrome", chrome.kind === "history" ? chrome.data.visits.length : 0],
      ["chatgpt", 15],
      ["transcript", 1],
    ]);
  });
});

describe("limits are applied transparently", () => {
  it("keeps all searches first when over maxHistoryItems and records totals", () => {
    const base = new Date(2026, 9, 1, 12).getTime();
    const visits: Visit[] = [];
    for (let i = 0; i < 100; i++) visits.push({ url: `https://site${i % 7}.example/page/${i}`, title: `Page ${i}`, ts: base + i * 1000 });
    for (let i = 0; i < 10; i++) visits.push({ url: `https://www.google.com/search?q=query+${i}`, title: `query ${i} - Google Search`, ts: base + i * 1000 });
    // the first 5 pages get many visits
    for (let i = 0; i < 5; i++) for (let k = 0; k < 20; k++) visits.push({ url: `https://site${i % 7}.example/page/${i}`, title: `Page ${i}`, ts: base + 1_000_000 + k });
    const p = prepare([history(visits)], { maxHistoryItems: 30 });
    expect(p.historyItems).toHaveLength(30);
    expect(p.historyItems.filter((i) => i.search)).toHaveLength(10);
    // of the remaining 20 slots, the most visited pages are there
    for (let i = 0; i < 5; i++) expect(p.historyItems.some((it) => it.title === `Page ${i}`)).toBe(true);
    expect(p.stats.analysed.historyItems).toBe(30);
    expect(p.stats.analysed.historyTotal).toBe(110);
    expect(p.stats.uniquePages).toBe(110);
    expect(p.stats.totalVisits).toBe(210);
    expect(p.historyItems.map((i) => i.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("limits conversations (newest first) and shortens very long ones", () => {
    const mkConv = (n: number, msgs = 4, len = 20): Conversation => ({
      id: `c${n}`,
      platform: "ChatGPT",
      title: `Conv ${n}`,
      startedAt: new Date(2026, 9, 1 + n).getTime(),
      messages: Array.from({ length: msgs }, (_, i) => ({ role: i % 2 === 0 ? "child" : "ai", text: "x".repeat(len) + ` ${i}`, ts: new Date(2026, 9, 1 + n, 10, i).getTime() })),
    });
    const convs = [mkConv(0), mkConv(1), mkConv(2), mkConv(3, 100, 300), mkConv(4, 3, 5000)];
    const p = prepare([{ kind: "chats", fileName: "c", data: { source: "chatgpt", label: "x", conversations: convs } }], { maxConversations: 3 });
    expect(p.conversations.map((c) => c.id)).toEqual(["c4", "c3", "c2"]);
    expect(p.stats.analysed.conversations).toBe(3);
    expect(p.stats.analysed.conversationsTotal).toBe(5);
    expect(p.stats.conversations).toBe(5);

    const long = p.conversations.find((c) => c.id === "c3")!;
    expect(long.truncated).toBe(true);
    expect(long.messages).toHaveLength(26); // first 6 + last 20
    expect(long.messages.map((m) => m.i)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    expect(long.messages[0].text.endsWith(" 0")).toBe(true);
    expect(long.messages[5].text.endsWith(" 5")).toBe(true);
    expect(long.messages[6].text.endsWith(" 80")).toBe(true);
    expect(long.messages[25].text.endsWith(" 99")).toBe(true);

    const huge = p.conversations.find((c) => c.id === "c4")!;
    expect(huge.truncated).toBe(true);
    expect(huge.messages.every((m) => m.text.length <= 2001)).toBe(true);

    expect(p.conversations.find((c) => c.id === "c2")!.truncated).toBe(false);
  });
});

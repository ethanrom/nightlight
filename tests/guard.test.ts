import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetMemoryStore, clientKey, guard, readJson, type Guard } from "../lib/guard";
import { costUsd } from "../lib/pricing";

const ENV_KEYS = [
  "LIVE_DEMO",
  "DAILY_BUDGET_USD",
  "IP_DAILY_BUDGET_USD",
  "IP_BURST_PER_MIN",
  "CHAT_PER_IP_DAILY",
  "PRICE_MULTIPLIER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

function req(ip = "203.0.113.7", headers: Record<string, string> = {}, body?: string): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "x-forwarded-for": ip, ...headers },
    body,
  });
}

async function allowed(r: Request, kind: Parameters<typeof guard>[1] = "classify"): Promise<Guard> {
  const g = await guard(r, kind);
  if (!g.ok) throw new Error(`expected allowed, got ${g.response.status}: ${await g.response.text()}`);
  return g;
}

async function denied(r: Request, kind: Parameters<typeof guard>[1] = "classify") {
  const g = await guard(r, kind);
  if (g.ok) throw new Error("expected the request to be denied");
  return { status: g.response.status, body: (await g.response.json()) as { ok: false; error: { kind: string; message: string } } };
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  _resetMemoryStore();
});
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("costUsd", () => {
  it("prices Sonnet and Haiku differently, with the safety multiplier", () => {
    process.env.PRICE_MULTIPLIER = "1";
    // 50K input + 50K output tokens at list price ($2/$10 Sonnet, $0.10/$0.50 Haiku per million)
    const u = { input_tokens: 50_000, output_tokens: 50_000 };
    expect(costUsd("arn:...:inference-profile/global.anthropic.claude-sonnet-5-5", u)).toBeCloseTo(0.6, 5);
    expect(costUsd("global.anthropic.claude-haiku-5-5", u)).toBeCloseTo(0.03, 5);
    process.env.PRICE_MULTIPLIER = "2";
    expect(costUsd("global.anthropic.claude-haiku-5-5", u)).toBeCloseTo(0.06, 5);
  });

  it("charges Haiku's higher rate for prompts over 100K tokens", () => {
    process.env.PRICE_MULTIPLIER = "1";
    // 200K in at $0.50/M + 10K out at $2.50/M
    expect(costUsd("haiku", { input_tokens: 200_000, output_tokens: 10_000 })).toBeCloseTo(0.1 + 0.025, 5);
  });

  it("counts cache reads and writes", () => {
    process.env.PRICE_MULTIPLIER = "1";
    const usd = costUsd("claude-sonnet-5-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1e6,
      cache_read_input_tokens: 1e6,
    });
    expect(usd).toBeCloseTo(2.5 + 0.2, 5);
  });

  it("matches the measured cost of a full demo run (about $0.15 at list price)", () => {
    process.env.PRICE_MULTIPLIER = "1";
    // token counts from a real run: 3 Haiku classify calls + 5 Sonnet audit/summary calls
    const haiku = [
      { input_tokens: 9055, output_tokens: 1386, cache_creation_input_tokens: 7634 },
      { input_tokens: 11063, output_tokens: 1645, cache_creation_input_tokens: 7634 },
      { input_tokens: 11060, output_tokens: 1738, cache_creation_input_tokens: 7634 },
    ];
    const sonnet = [
      { input_tokens: 3721, output_tokens: 1004, cache_read_input_tokens: 9053 },
      { input_tokens: 2659, output_tokens: 1389, cache_read_input_tokens: 9053 },
      { input_tokens: 4757, output_tokens: 1439, cache_read_input_tokens: 9053 },
      { input_tokens: 2394, output_tokens: 1637, cache_read_input_tokens: 9053 },
      { input_tokens: 12674, output_tokens: 2995, cache_read_input_tokens: 7319 },
    ];
    const total = [...haiku.map((u) => costUsd("haiku", u)), ...sonnet.map((u) => costUsd("sonnet", u))].reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0.1);
    expect(total).toBeLessThan(0.25);
  });
});

describe("clientKey", () => {
  it("is stable per IP, differs between IPs, and doesn't contain the IP", () => {
    const a = clientKey(req("198.51.100.1"));
    expect(a).toBe(clientKey(req("198.51.100.1")));
    expect(a).not.toBe(clientKey(req("198.51.100.2")));
    expect(a).not.toContain("198");
  });

  it("prefers Vercel's forwarded header over a client-supplied one", () => {
    const spoof = clientKey(req("1.1.1.1", { "x-vercel-forwarded-for": "9.9.9.9" }));
    expect(spoof).toBe(clientKey(req("2.2.2.2", { "x-vercel-forwarded-for": "9.9.9.9" })));
  });
});

describe("guard", () => {
  it("lets a normal request through", async () => {
    const g = await allowed(req());
    g.track(0.01);
    await g.settle();
  });

  it("blocks a visitor once their daily spend cap is reached, but not other visitors", async () => {
    process.env.IP_DAILY_BUDGET_USD = "0.30";
    const a = await allowed(req("10.0.0.1"));
    a.track(0.2);
    await a.settle();
    const a2 = await allowed(req("10.0.0.1")); // 0.20 < 0.30
    a2.track(0.2);
    await a2.settle();
    const blocked = await denied(req("10.0.0.1")); // 0.40 >= 0.30
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.kind).toBe("rate_limited");
    expect(blocked.body.error.message).toMatch(/limit/i);
    await allowed(req("10.0.0.2")); // someone else is unaffected
  });

  it("blocks everyone once the global daily budget is reached", async () => {
    process.env.DAILY_BUDGET_USD = "0.25";
    const a = await allowed(req("10.0.0.1"));
    a.track(0.3);
    await a.settle();
    const blocked = await denied(req("10.0.0.99"));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/budget/i);
  });

  it("settle is idempotent and ignores nonsense costs", async () => {
    process.env.DAILY_BUDGET_USD = "1";
    const a = await allowed(req("10.0.0.1"));
    a.track(0.4);
    a.track(Number.NaN);
    a.track(-5);
    await a.settle();
    await a.settle(); // must not double count
    const b = await allowed(req("10.0.0.2"));
    b.track(0.4);
    await b.settle(); // total 0.8 < 1
    await allowed(req("10.0.0.3"));
  });

  it("limits bursts per visitor", async () => {
    process.env.IP_BURST_PER_MIN = "3";
    for (let i = 0; i < 3; i++) await allowed(req("10.0.0.5"));
    const blocked = await denied(req("10.0.0.5"));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/too many/i);
  });

  it("caps chat questions per visitor per day", async () => {
    process.env.CHAT_PER_IP_DAILY = "2";
    await allowed(req("10.0.0.6"), "chat");
    await allowed(req("10.0.0.6"), "chat");
    const blocked = await denied(req("10.0.0.6"), "chat");
    expect(blocked.status).toBe(429);
    // the analysis routes are not subject to the chat question cap
    await allowed(req("10.0.0.6"), "classify");
  });

  it("can be paused with LIVE_DEMO=off", async () => {
    process.env.LIVE_DEMO = "off";
    const blocked = await denied(req());
    expect(blocked.status).toBe(503);
    expect(blocked.body.error.kind).toBe("paused");
  });

  it("rejects cross-site browser requests", async () => {
    const blocked = await denied(req("10.0.0.7", { "sec-fetch-site": "cross-site" }));
    expect(blocked.status).toBe(403);
    await allowed(req("10.0.0.7", { "sec-fetch-site": "same-origin" }));
  });

  it("sends Retry-After and never caches denials", async () => {
    process.env.LIVE_DEMO = "off";
    const g = await guard(req(), "classify");
    if (g.ok) throw new Error("expected denial");
    expect(g.response.headers.get("retry-after")).toBe("60");
    expect(g.response.headers.get("cache-control")).toBe("no-store");
  });

  it("falls back to memory when the shared store is unreachable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9"; // nothing listens here
    process.env.UPSTASH_REDIS_REST_TOKEN = "x";
    process.env.IP_BURST_PER_MIN = "1";
    await allowed(req("10.0.0.8"));
    const blocked = await denied(req("10.0.0.8"));
    expect(blocked.status).toBe(429); // limits still enforced, per instance
  });
});

describe("readJson", () => {
  it("parses a normal body", async () => {
    const r = await readJson(req("1.2.3.4", {}, JSON.stringify({ a: 1 })), "classify");
    expect(r).toEqual({ ok: true, body: { a: 1 } });
  });

  it("rejects an oversized body with 413", async () => {
    const big = JSON.stringify({ x: "a".repeat(200_000) });
    const r = await readJson(req("1.2.3.4", {}, big), "classify");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it("allows bigger bodies for the summary than for classification", async () => {
    const mid = JSON.stringify({ x: "a".repeat(300_000) });
    const classify = await readJson(req("1.2.3.4", {}, mid), "classify");
    const summarize = await readJson(req("1.2.3.4", {}, mid), "summarize");
    expect(classify.ok).toBe(false);
    expect(summarize.ok).toBe(true);
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await readJson(req("1.2.3.4", {}, "{nope"), "classify");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});

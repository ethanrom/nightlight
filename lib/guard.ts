// Server-only: protects the public demo's Bedrock budget.
//
// Every LLM route calls guard() before doing any work and settle() afterwards:
//   - a global daily spend cap and a per-visitor daily spend cap (estimated from real token usage, see pricing.ts)
//   - a per-visitor burst limit and, for the chat, a per-visitor daily question cap
//   - a pause switch (LIVE_DEMO=off) and a same-site check
//   - request-size caps (readJson), so one request can't be made arbitrarily expensive
//
// Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL/_TOKEN (or Vercel's KV_REST_API_URL/_TOKEN) are set,
// which makes the limits global across serverless instances. Without them (local dev, or a store outage) it falls
// back to per-instance memory: still useful, but a determined attacker can spread across instances.
//
// Privacy: only counters are stored, keyed by a salted hash of the IP, and they expire within two days. No request
// content is ever stored.
import { createHash } from "node:crypto";
import type { ApiResult, LlmErrorKind } from "./types";

export type GuardKind = "classify" | "audit" | "summarize" | "chat";

const num = (v: string | undefined, fallback: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function limits() {
  return {
    live: (process.env.LIVE_DEMO ?? "on").trim().toLowerCase() !== "off",
    /** estimated USD the whole demo may spend per UTC day */
    globalDailyUsd: num(process.env.DAILY_BUDGET_USD, 10),
    /** estimated USD one visitor (IP) may spend per UTC day: roughly 3-6 full analyses */
    ipDailyUsd: num(process.env.IP_DAILY_BUDGET_USD, 1),
    /** API calls one visitor may make per minute (a full analysis makes about 9) */
    ipBurstPerMin: num(process.env.IP_BURST_PER_MIN, 40),
    /** Ask Nightlight questions one visitor may send per UTC day */
    chatPerIpDaily: num(process.env.CHAT_PER_IP_DAILY, 60),
  };
}

/** Max request body per route, in characters. Normal requests are far smaller (see lib/pipeline.ts batching). */
export const BODY_LIMITS: Record<GuardKind, number> = {
  classify: 150_000,
  audit: 150_000,
  summarize: 600_000,
  chat: 500_000,
};

// ------------------------------------------------------------------ store (Upstash REST, or memory)

type Cmd = (string | number)[];
type Reply = string | number | null;

const mem = new Map<string, { v: number; exp: number }>();
function memRun(cmds: Cmd[]): Reply[] {
  const now = Date.now();
  if (mem.size > 5000) for (const [k, e] of mem) if (e.exp <= now) mem.delete(k);
  return cmds.map(([op, key, arg]) => {
    const k = String(key);
    const cur = mem.get(k);
    const live = cur && cur.exp > now ? cur : undefined;
    switch (op) {
      case "GET":
        return live ? live.v : null;
      case "INCR":
      case "INCRBYFLOAT": {
        const next = (live?.v ?? 0) + (op === "INCR" ? 1 : Number(arg));
        mem.set(k, { v: next, exp: live?.exp ?? now + 172_800_000 });
        return next;
      }
      case "EXPIRE": {
        const e = mem.get(k);
        if (e) e.exp = now + Number(arg) * 1000;
        return e ? 1 : 0;
      }
      default:
        return null;
    }
  });
}

function remoteConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

let warned = false;
async function run(cmds: Cmd[]): Promise<Reply[]> {
  const remote = remoteConfig();
  if (remote) {
    try {
      const res = await fetch(`${remote.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${remote.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cmds),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) throw new Error(`store HTTP ${res.status}`);
      const out = (await res.json()) as { result?: Reply; error?: string }[];
      return out.map((r) => {
        if (r.error) throw new Error(r.error);
        return r.result ?? null;
      });
    } catch (err) {
      if (!warned) {
        warned = true;
        console.warn("[guard] limit store unavailable, using per-instance memory:", err instanceof Error ? err.message : err);
      }
    }
  }
  return memRun(cmds);
}

// ------------------------------------------------------------------ helpers

export function clientKey(req: Request): string {
  const ip =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "local";
  return createHash("sha256")
    .update((process.env.RATE_LIMIT_SALT || "nightlight") + ip.trim())
    .digest("hex")
    .slice(0, 20);
}

function deny(status: number, kind: LlmErrorKind, message: string): { ok: false; response: Response } {
  return {
    ok: false,
    response: Response.json({ ok: false, error: { kind, message } } satisfies ApiResult<never>, {
      status,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    }),
  };
}

export type DenyResult = ReturnType<typeof deny>;

/** Reads a JSON body with a size cap. */
export async function readJson(
  req: Request,
  kind: GuardKind,
): Promise<{ ok: true; body: unknown } | DenyResult> {
  const max = BODY_LIMITS[kind];
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max * 1.2) return deny(413, "bad_request", "That request is too large.");
  let text: string;
  try {
    text = await req.text();
  } catch {
    return deny(400, "bad_request", "Couldn't read the request body.");
  }
  if (text.length > max) return deny(413, "bad_request", "That request is too large.");
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return deny(400, "bad_request", "Request body must be JSON.");
  }
}

// ------------------------------------------------------------------ the guard

export interface Guard {
  ok: true;
  /** Adds the estimated cost (USD) of one model call to this request's tally. */
  track: (usd: number) => void;
  /** Writes the tally to the spend counters. Safe to call more than once. */
  settle: () => Promise<void>;
}

export async function guard(req: Request, kind: GuardKind): Promise<Guard | DenyResult> {
  const L = limits();
  if (!L.live) {
    return deny(503, "paused", "The live demo is paused for now. You can still open the sample report.");
  }
  // Browsers always send Sec-Fetch-Site; refuse other websites driving our API from a visitor's browser.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return deny(403, "bad_request", "Cross-site requests are not allowed.");
  }

  const ip = clientKey(req);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minute = Math.floor(now.getTime() / 60_000);
  const gKey = `spend:g:${day}`;
  const iKey = `spend:i:${ip}:${day}`;
  const bKey = `burst:${ip}:${minute}`;
  const cKey = `chat:${ip}:${day}`;

  const cmds: Cmd[] = [["GET", gKey], ["GET", iKey], ["INCR", bKey], ["EXPIRE", bKey, 120]];
  if (kind === "chat") cmds.push(["INCR", cKey], ["EXPIRE", cKey, 172_800]);
  const r = await run(cmds);
  const globalSpend = Number(r[0] ?? 0);
  const ipSpend = Number(r[1] ?? 0);
  const burst = Number(r[2] ?? 0);
  const chats = kind === "chat" ? Number(r[4] ?? 0) : 0;

  if (burst > L.ipBurstPerMin) {
    return deny(429, "rate_limited", "Too many requests in a short time. Please wait a minute and try again.");
  }
  if (globalSpend >= L.globalDailyUsd) {
    return deny(
      429,
      "rate_limited",
      "The public demo has used up today's AI budget. You can still explore the sample report, and the full source is on GitHub.",
    );
  }
  if (ipSpend >= L.ipDailyUsd) {
    return deny(
      429,
      "rate_limited",
      "You've reached today's limit for live analysis from this network. The sample report is still available.",
    );
  }
  if (kind === "chat" && chats > L.chatPerIpDaily) {
    return deny(429, "rate_limited", "You've reached today's limit of questions from this network. Please try again tomorrow.");
  }

  let spent = 0;
  let settled = false;
  return {
    ok: true,
    track: (usd) => {
      if (Number.isFinite(usd) && usd > 0) spent += usd;
    },
    settle: async () => {
      if (settled || spent <= 0) return;
      settled = true;
      const amount = Number(spent.toFixed(6));
      try {
        await run([
          ["INCRBYFLOAT", gKey, amount],
          ["EXPIRE", gKey, 172_800],
          ["INCRBYFLOAT", iKey, amount],
          ["EXPIRE", iKey, 172_800],
        ]);
      } catch {
        /* never fail a request over bookkeeping */
      }
    },
  };
}

/** Test helper: clears the in-memory counters. */
export function _resetMemoryStore(): void {
  mem.clear();
}

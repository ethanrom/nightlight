// POST /api/classify-history: triage a batch of (client-parsed) history items against the Child Safety Lens.
import { guard, readJson } from "@/lib/guard";
import { errorResponse, structured } from "@/lib/llm";
import { reconcileSeverity } from "@/lib/postprocess";
import { classifyHistorySystem, classifyHistoryUser } from "@/lib/prompts";
import { severityRank } from "@/lib/rubric";
import { ClassifyHistoryRequestSchema, ClassifyHistoryResultSchema } from "@/lib/schemas";
import type { ApiResult, ClassifyHistoryResult } from "@/lib/types";

export const maxDuration = 60;

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: { kind: "bad_request", message } } satisfies ApiResult<never>, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  const g = await guard(req, "classify");
  if (!g.ok) return g.response;
  const raw = await readJson(req, "classify");
  if (!raw.ok) return raw.response;
  const parsed = ClassifyHistoryRequestSchema.safeParse(raw.body);
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { ageBand, items } = parsed.data;

  if (items.length === 0) {
    return Response.json({ ok: true, result: { flags: [], domains: [] } } satisfies ApiResult<ClassifyHistoryResult>);
  }

  try {
    const out = await structured({
      schema: ClassifyHistoryResultSchema,
      system: classifyHistorySystem(ageBand),
      user: classifyHistoryUser(items),
      maxTokens: 8000,
      effort: "low",
      tier: "fast",
      track: g.track,
    });

    // Drop flags for ids that aren't in this batch; keep one flag per (id, dimension), most severe wins.
    const ids = new Set(items.map((i) => i.id));
    const best = new Map<string, ClassifyHistoryResult["flags"][number]>();
    for (const raw of out.flags) {
      if (!ids.has(raw.id)) continue;
      const flag = reconcileSeverity({ ...raw, reason: raw.reason.trim() });
      const key = `${flag.id}:${flag.dimension}`;
      const prev = best.get(key);
      if (!prev || severityRank(flag.severity) > severityRank(prev.severity)) best.set(key, flag);
    }
    const flags = [...best.values()];

    // One category per distinct domain in the batch: canonical domain strings, none missing, none invented.
    const canonical = new Map<string, string>();
    for (const it of items) canonical.set(it.domain.toLowerCase(), it.domain);
    const categories = new Map<string, ClassifyHistoryResult["domains"][number]["category"]>();
    for (const d of out.domains) {
      const domain = canonical.get(d.domain.trim().toLowerCase());
      if (domain && !categories.has(domain)) categories.set(domain, d.category);
    }
    const domains = [...canonical.values()].map((domain) => ({
      domain,
      category: categories.get(domain) ?? ("other" as const),
    }));

    return Response.json({ ok: true, result: { flags, domains } } satisfies ApiResult<ClassifyHistoryResult>);
  } catch (err) {
    return errorResponse(err);
  } finally {
    await g.settle();
  }
}

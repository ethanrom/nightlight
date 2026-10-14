// POST /api/summarize: cross-conversation trends, ranked concerns and conversation starters for the parent.
import { guard, readJson } from "@/lib/guard";
import { errorResponse, structured } from "@/lib/llm";
import { bySeverityDesc, filterRefs, overallFromSeverities } from "@/lib/postprocess";
import { severityRank, type Severity } from "@/lib/rubric";
import { summarizeSystem, summarizeUser, validEvidenceRefs } from "@/lib/prompts";
import { SummarizeRequestSchema, SummarySchema } from "@/lib/schemas";
import type { ApiResult, Summary } from "@/lib/types";

export const maxDuration = 60;

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: { kind: "bad_request", message } } satisfies ApiResult<never>, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  const g = await guard(req, "summarize");
  if (!g.ok) return g.response;
  const raw = await readJson(req, "summarize");
  if (!raw.ok) return raw.response;
  const parsed = SummarizeRequestSchema.safeParse(raw.body);
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const input = parsed.data;

  // Keep the prompt bounded: the most severe (then most recent) flagged pages, healthy "normal" flags last.
  const MAX_FLAGGED_HISTORY = 200;
  const MAX_PII = 100;
  const shownHistory = [...input.flaggedHistory]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.lastSeen - a.lastSeen)
    .slice(0, MAX_FLAGGED_HISTORY);
  const shown = { ...input, flaggedHistory: shownHistory, pii: input.pii.slice(0, MAX_PII) };

  try {
    const out = await structured({
      schema: SummarySchema,
      system: summarizeSystem(input.ageBand, input.childName),
      user: summarizeUser(shown),
      maxTokens: 8000,
      effort: "medium",
      track: g.track,
    });

    // Severity of the evidence behind each ref, so a concern is never ranked below what it cites
    // (e.g. an urgent "I feel like a burden" search merged into a broader "talk soon" mood concern).
    const refSeverity = new Map<string, Severity>();
    const raise = (ref: string, sev: Severity) => {
      const prev = refSeverity.get(ref);
      if (!prev || severityRank(sev) > severityRank(prev)) refSeverity.set(ref, sev);
    };
    for (const h of shown.flaggedHistory) raise(`h:${h.id}`, h.severity);
    for (const a of input.audits) for (const f of a.flags) raise(`c:${a.id}:${f.message_index}`, f.severity);

    // Only refs that exist in the input; concerns ranked by severity; no "normal" items as concerns.
    const valid = validEvidenceRefs(shown);
    const concerns = out.top_concerns
      .filter((c) => c.severity !== "normal")
      .map((c) => {
        const evidence_refs = filterRefs(c.evidence_refs, valid);
        const severity = evidence_refs.reduce<Severity>((max, ref) => {
          const sev = refSeverity.get(ref);
          return sev && severityRank(sev) > severityRank(max) ? sev : max;
        }, c.severity);
        return { ...c, evidence_refs, severity };
      })
      .sort(bySeverityDesc)
      .slice(0, 6);

    // Backstop: an urgent upstream flag the model left uncited raises the matching concern
    // (same dimension, or wellbeing for a self-harm signal) to urgent and adds the evidence.
    const cited = new Set(concerns.flatMap((c) => c.evidence_refs));
    const urgentFlags = [
      ...shown.flaggedHistory.map((h) => ({ ref: `h:${h.id}`, dimension: h.dimension, severity: h.severity })),
      ...input.audits.flatMap((a) =>
        a.flags.map((f) => ({ ref: `c:${a.id}:${f.message_index}`, dimension: f.dimension, severity: f.severity })),
      ),
    ].filter((f) => f.severity === "urgent" && valid.has(f.ref) && !cited.has(f.ref));
    for (const f of urgentFlags) {
      if (concerns.some((c) => c.dimension === f.dimension && c.severity === "urgent")) continue;
      const target =
        concerns.find((c) => c.dimension === f.dimension) ??
        (f.dimension === "self_harm" ? concerns.find((c) => c.dimension === "wellbeing_drift") : undefined);
      if (!target) continue;
      target.severity = "urgent";
      target.evidence_refs = [f.ref, ...target.evidence_refs];
      cited.add(f.ref);
    }
    concerns.sort(bySeverityDesc);

    // `overall` follows the stated rule over everything we know (model concerns and upstream non-normal flags),
    // so an urgent signal can never be summarised away.
    const severities = [
      ...concerns.map((c) => c.severity),
      ...input.flaggedHistory.filter((h) => !h.developmentally_normal).map((h) => h.severity),
      ...input.audits.flatMap((a) => a.flags.filter((f) => !f.developmentally_normal).map((f) => f.severity)),
    ];

    const result: Summary = {
      ...out,
      overall: overallFromSeverities(severities),
      top_concerns: concerns,
      trends: out.trends.slice(0, 6),
    };
    return Response.json({ ok: true, result } satisfies ApiResult<Summary>);
  } catch (err) {
    return errorResponse(err);
  } finally {
    await g.settle();
  }
}

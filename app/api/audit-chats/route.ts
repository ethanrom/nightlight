// POST /api/audit-chats: audit conversations (child + AI) against the Child Safety Lens and grade the AI's replies.
import { errorResponse, structured } from "@/lib/llm";
import { anchorExcerpt, reconcileSeverity } from "@/lib/postprocess";
import { auditChatsSystem, auditChatsUser } from "@/lib/prompts";
import type { AgeBand } from "@/lib/rubric";
import { AuditChatsRequestSchema, AuditChatsResultSchema, TzOffsetSchema } from "@/lib/schemas";
import type { ApiResult, AuditChatsResult, ChatAudit, PreparedConversation } from "@/lib/types";

export const maxDuration = 60;

const RequestSchema = AuditChatsRequestSchema.extend({ tzOffsetMinutes: TzOffsetSchema });

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: { kind: "bad_request", message } } satisfies ApiResult<never>, { status: 400 });
}

async function auditBatch(ageBand: AgeBand, conversations: PreparedConversation[], tz?: number): Promise<ChatAudit[]> {
  const out = await structured({
    schema: AuditChatsResultSchema,
    system: auditChatsSystem(ageBand),
    user: auditChatsUser(conversations, tz),
    maxTokens: 16000,
    effort: "low",
  });
  return out.audits;
}

/** Validate one audit against its conversation: real flags only, anchored to real messages, consistent severities. */
function cleanAudit(audit: ChatAudit, conv: PreparedConversation): ChatAudit {
  const flags: ChatAudit["flags"] = [];
  for (const raw of audit.flags) {
    const anchor = anchorExcerpt(conv.messages, raw.message_index, raw.excerpt);
    if (!anchor) continue;
    flags.push(reconcileSeverity({ ...raw, message_index: anchor.index, excerpt: anchor.excerpt.trim() }));
  }
  return {
    ...audit,
    id: conv.id,
    child_mood: Math.max(-2, Math.min(2, Math.round(audit.child_mood))),
    topics: audit.topics.slice(0, 3),
    flags,
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON.");
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { ageBand, conversations, tzOffsetMinutes } = parsed.data;

  if (conversations.length === 0) {
    return Response.json({ ok: true, result: { audits: [] } } satisfies ApiResult<AuditChatsResult>);
  }

  try {
    const byId = new Map(conversations.map((c) => [c.id, c]));
    const audits = new Map<string, ChatAudit>();
    const take = (batch: ChatAudit[]) => {
      for (const a of batch) {
        const conv = byId.get(a.id) ?? byId.get(a.id.trim());
        if (!conv || audits.has(conv.id)) continue; // unknown id or duplicate
        audits.set(conv.id, cleanAudit(a, conv));
      }
    };

    take(await auditBatch(ageBand, conversations, tzOffsetMinutes));

    // The model occasionally skips one; retry once for just the missing conversations.
    const missing = conversations.filter((c) => !audits.has(c.id));
    if (missing.length) {
      console.warn(`[audit-chats] ${missing.length} conversation(s) missing from first pass; retrying`);
      try {
        take(await auditBatch(ageBand, missing, tzOffsetMinutes));
      } catch (err) {
        console.error("[audit-chats] retry failed:", err instanceof Error ? err.message : err);
      }
    }

    // Input order, only conversations that were actually audited.
    const result: AuditChatsResult = {
      audits: conversations.flatMap((c) => {
        const a = audits.get(c.id);
        return a ? [a] : [];
      }),
    };
    return Response.json({ ok: true, result } satisfies ApiResult<AuditChatsResult>);
  } catch (err) {
    return errorResponse(err);
  }
}

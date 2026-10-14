// POST /api/chat ("Ask Nightlight"): streams a plain-text (markdown) answer grounded in the report context.
// The answer may contain interactive cards as ```card fenced JSON blocks (see lib/chat-cards.ts); the client
// validates and renders them. The stream stays plain text so it is trivial to consume and to cache.
import type { MessageStreamEvent } from "@anthropic-ai/sdk/resources/messages";
import { guard, readJson } from "@/lib/guard";
import { errorResponse, getClient, getModel, LlmError, reportUsage, thinkingFor } from "@/lib/llm";
import { openFenceLine } from "@/lib/chat-cards";
import { CHAT_ERROR_NOTE, CHAT_REFUSAL_NOTE, chatSystem } from "@/lib/prompts";
import { ChatRequestSchema } from "@/lib/schemas";
import type { ApiResult } from "@/lib/types";

export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 12;
/** ~100k tokens of JSON; chat-context.ts targets far less, this only stops abuse and accidents. */
const MAX_CONTEXT_CHARS = 400_000;

function badRequest(message: string): Response {
  return Response.json({ ok: false, error: { kind: "bad_request", message } } satisfies ApiResult<never>, { status: 400 });
}

export async function POST(req: Request): Promise<Response> {
  const g = await guard(req, "chat");
  if (!g.ok) return g.response;
  const raw = await readJson(req, "chat");
  if (!raw.ok) return raw.response;
  const parsed = ChatRequestSchema.safeParse(raw.body);
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { ageBand, childName, context, messages } = parsed.data;

  const contextJson = JSON.stringify(context);
  if (contextJson.length > MAX_CONTEXT_CHARS) return badRequest("Report context is too large.");

  // Last 12 messages, starting with a user turn and ending with one.
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== "user") {
    return badRequest("The last message must be from the user.");
  }

  const model = getModel("fast");
  let stream;
  try {
    stream = getClient().messages.stream(
      {
        model,
        // Prose is short, but each card is a line of JSON: leave room so a card is never cut off mid-object.
        max_tokens: 2500,
        // The big, stable block (instructions + report context) is cached across questions in a session.
        system: [{ type: "text", text: chatSystem(ageBand, childName, contextJson), cache_control: { type: "ephemeral" } }],
        messages: recent,
        output_config: { effort: "low" },
        ...thinkingFor(model),
      },
      { signal: req.signal },
    );
  } catch (err) {
    return errorResponse(err instanceof LlmError ? err : new LlmError("api", err instanceof Error ? err.message : String(err)));
  }

  const iterator = stream[Symbol.asyncIterator]();
  const textOf = (ev: MessageStreamEvent): string | null =>
    ev.type === "content_block_delta" && ev.delta.type === "text_delta" ? ev.delta.text : null;

  // Wait for the first token before answering 200, so auth/model/rate-limit failures come back as proper JSON errors.
  const buffered: string[] = [];
  let finishedEarly = false;
  try {
    for (;;) {
      const r = await iterator.next();
      if (r.done) {
        finishedEarly = true;
        break;
      }
      const t = textOf(r.value);
      if (t !== null) {
        buffered.push(t);
        break;
      }
    }
  } catch (err) {
    return errorResponse(new LlmError("api", err instanceof Error ? err.message : String(err)));
  }

  const encoder = new TextEncoder();
  // Everything sent so far, so a note appended after a cut-off answer never lands inside an unfinished card block.
  let sent = "";
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (t: string) => {
        sent += t;
        controller.enqueue(encoder.encode(t));
      };
      /** Closes a card fence the model left open, then appends the note. */
      const pushNote = (note: string) => push(openFenceLine(sent) !== null ? "\n```" + note : note);
      try {
        for (const t of buffered) push(t);
        if (!finishedEarly) {
          for (;;) {
            const r = await iterator.next();
            if (r.done) break;
            const t = textOf(r.value);
            if (t !== null) push(t);
          }
        }
        const final = await stream.finalMessage();
        reportUsage("chat", model, final.usage, g.track);
        if (final.stop_reason === "refusal") pushNote(CHAT_REFUSAL_NOTE);
        else if (final.stop_reason === "max_tokens") pushNote("\n\n…");
      } catch (err) {
        console.error("[chat] stream failed:", err instanceof Error ? err.message : err);
        if (!req.signal.aborted) pushNote(CHAT_ERROR_NOTE);
      } finally {
        await g.settle();
        try {
          controller.close();
        } catch {
          /* already closed by cancel */
        }
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(out, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

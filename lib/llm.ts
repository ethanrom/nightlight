// Server-only: Claude on Amazon Bedrock, with structured (schema-validated) outputs.
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { LlmErrorKind } from "./types";

let client: AnthropicBedrock | null = null;

export function getClient(): AnthropicBedrock {
  if (!client) {
    const awsAccessKey = process.env.CLAUDE_AWS_ACCESS_KEY;
    const awsSecretKey = process.env.CLAUDE_AWS_SECRET_KEY;
    const awsRegion = process.env.CLAUDE_AWS_REGION;
    if (!awsAccessKey || !awsSecretKey || !awsRegion) {
      throw new LlmError("api", "Missing CLAUDE_AWS_ACCESS_KEY / CLAUDE_AWS_SECRET_KEY / CLAUDE_AWS_REGION");
    }
    client = new AnthropicBedrock({ awsAccessKey, awsSecretKey, awsRegion, maxRetries: 3 });
  }
  return client;
}

/**
 * "smart" (Sonnet) handles the nuanced judgement: auditing chats and the cross-conversation summary.
 * "fast" (Haiku) handles high-volume, simpler work: classifying history items and the parent chat.
 */
export type ModelTier = "smart" | "fast";

/** Bedrock model id or inference-profile ARN for a tier. "fast" falls back to the smart model if unset. */
export function getModel(tier: ModelTier = "smart"): string {
  const smart = process.env.CLAUDE_AWS_MODEL;
  if (!smart) throw new LlmError("api", "Missing CLAUDE_AWS_MODEL");
  return tier === "fast" ? process.env.CLAUDE_AWS_FAST_MODEL || smart : smart;
}

/**
 * Thinking setting per model. Haiku 5.5 may disable thinking (at effort <= high), which halves its
 * latency on classification; Sonnet 5.5 rejects `disabled`, so it keeps the default adaptive mode.
 */
export function thinkingFor(model: string): { thinking?: { type: "disabled" } } {
  return /haiku/i.test(model) ? { thinking: { type: "disabled" } } : {};
}

export class LlmError extends Error {
  constructor(
    public kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface StructuredOptions<T extends z.ZodType> {
  schema: T;
  system: string;
  user: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  tier?: ModelTier;
}

/** One structured-output call. Throws LlmError on refusal, truncation or invalid output. */
export async function structured<T extends z.ZodType>({
  schema,
  system,
  user,
  maxTokens = 16000,
  effort = "low",
  tier = "smart",
}: StructuredOptions<T>): Promise<z.infer<T>> {
  const model = getModel(tier);
  let res;
  try {
    res = await getClient().messages.parse({
      model,
      max_tokens: maxTokens,
      // The rubric-heavy system prompt is identical across batches, so cache it.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: zodOutputFormat(schema) },
      ...thinkingFor(model),
    });
  } catch (err) {
    if (err instanceof LlmError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    // The SDK raises a plain AnthropicError when the output fails schema validation.
    if (/structured output/i.test(message)) throw new LlmError("invalid_output", message);
    throw new LlmError("api", message);
  }

  if (res.stop_reason === "refusal") {
    throw new LlmError("refusal", "The model declined to analyse this batch.");
  }
  if (res.stop_reason === "max_tokens") {
    throw new LlmError("truncated", "The response was cut off before it finished.");
  }
  if (res.parsed_output == null) {
    throw new LlmError("invalid_output", "The model returned no parseable output.");
  }
  return res.parsed_output as z.infer<T>;
}

/** Shape every route returns on failure. */
export function errorResponse(err: unknown, status = 502): Response {
  const kind: LlmErrorKind = err instanceof LlmError ? err.kind : "api";
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(`[llm:${kind}]`, message);
  return Response.json({ ok: false, error: { kind, message } }, { status });
}

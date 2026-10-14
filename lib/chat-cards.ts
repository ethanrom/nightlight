// Interactive "cards" inside Ask Nightlight answers.
//
// Wire format (kept streaming-friendly): the model writes normal markdown and inserts a card as a fenced code
// block with the language `card`, holding ONE JSON object:
//
//   ```card
//   {"type":"starter","text":"...","tone":"gentle"}
//   ```
//
// The client renders each block with a custom react-markdown `code` renderer. This file is the single source of
// truth for the card spec: the zod schema (used by the client AND the backend test), the prompt text that teaches
// the model the protocol, and small pure helpers for fences and citations. No numbers, charts or URLs are ever
// taken from the model: charts are computed from the report, resources come from lib/resources.ts.
import { z } from "zod";
import { DIMENSION_IDS } from "./rubric";

export const CARD_LANG = "card";
/** The most cards (not counting the closing `followups`) one answer may carry. */
export const MAX_CARDS_PER_ANSWER = 3;

// ---------------------------------------------------------------- schema

const Dimension = z.enum(DIMENSION_IDS);

export const CHART_KINDS = ["daily_activity", "late_night", "mood_trend"] as const;
export const STARTER_TONES = ["gentle", "direct", "playful"] as const;

export const EvidenceCardSchema = z.object({
  type: z.literal("evidence"),
  refs: z.array(z.string().trim().min(1)).min(1).max(8),
  note: z.string().trim().max(240).optional(),
});

export const StarterCardSchema = z.object({
  type: z.literal("starter"),
  text: z.string().trim().min(4).max(600),
  // Be lenient: an unknown tone should not cost the parent the whole card.
  tone: z.enum(STARTER_TONES).catch("gentle"),
});

export const ChartCardSchema = z.object({
  type: z.literal("chart"),
  kind: z.enum(CHART_KINDS),
  title: z.string().trim().max(80).optional(),
});

export const ConcernCardSchema = z.object({ type: z.literal("concern"), dimension: Dimension });

export const ResourcesCardSchema = z.object({
  type: z.literal("resources"),
  dimensions: z.array(Dimension).min(1).max(6),
});

export const PlanCardSchema = z.object({
  type: z.literal("plan"),
  title: z.string().trim().min(2).max(90),
  steps: z.array(z.string().trim().min(2).max(240)).min(1).max(8),
});

export const FollowupsCardSchema = z.object({
  type: z.literal("followups"),
  questions: z.array(z.string().trim().min(3).max(140)).min(1).max(5),
});

export const DimensionCardSchema = z.object({ type: z.literal("dimension"), dimension: Dimension });

export const CardSchema = z.discriminatedUnion("type", [
  EvidenceCardSchema,
  StarterCardSchema,
  ChartCardSchema,
  ConcernCardSchema,
  ResourcesCardSchema,
  PlanCardSchema,
  FollowupsCardSchema,
  DimensionCardSchema,
]);

export type Card = z.infer<typeof CardSchema>;
export type CardType = Card["type"];
export type CardOf<T extends CardType> = Extract<Card, { type: T }>;
export type ChartKind = (typeof CHART_KINDS)[number];
export type StarterTone = (typeof STARTER_TONES)[number];

// ---------------------------------------------------------------- parsing

/** Parses the JSON inside a card block. Returns null for invalid JSON or a spec violation (the card is dropped). */
export function parseCard(raw: string): Card | null {
  const text = raw.trim();
  if (!text.startsWith("{")) return null;
  try {
    const r = CardSchema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** react-markdown gives fenced code a `language-<lang>` class. */
export function isCardLang(className?: string): boolean {
  return !!className && /(^|\s)language-card(\s|$)/.test(className);
}

/** Best-effort card type of a block that is still streaming, so the skeleton can say what is coming. */
export function peekCardType(partial: string): CardType | null {
  const m = /"type"\s*:\s*"([a-z_]+)"/.exec(partial);
  const t = m?.[1];
  return t && (CARD_TYPE_NAMES as readonly string[]).includes(t) ? (t as CardType) : null;
}

export interface FenceBlock {
  lang: string;
  body: string;
  /** 1-based line of the opening fence (matches react-markdown's node.position.start.line) */
  startLine: number;
  /** false when the stream ended before the closing fence */
  closed: boolean;
}

/** Finds fenced code blocks (backtick fences) in a markdown string, including a trailing unclosed one. */
export function scanFences(text: string): FenceBlock[] {
  const blocks: FenceBlock[] = [];
  const lines = text.split("\n");
  let open: { lang: string; ticks: number; startLine: number; body: string[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!open) {
      const m = /^ {0,3}(`{3,})[ \t]*([^\s`]*)/.exec(line);
      if (m) open = { lang: m[2].toLowerCase(), ticks: m[1].length, startLine: i + 1, body: [] };
      continue;
    }
    const close = /^ {0,3}(`{3,})[ \t]*$/.exec(line);
    if (close && close[1].length >= open.ticks) {
      blocks.push({ lang: open.lang, body: open.body.join("\n"), startLine: open.startLine, closed: true });
      open = null;
    } else {
      open.body.push(line);
    }
  }
  if (open) blocks.push({ lang: open.lang, body: open.body.join("\n"), startLine: open.startLine, closed: false });
  return blocks;
}

/** Line number (1-based) of a fence that has not been closed yet, or null. */
export function openFenceLine(text: string): number | null {
  const last = scanFences(text).at(-1);
  return last && !last.closed ? last.startLine : null;
}

export interface ExtractedCards {
  /** the answer with card blocks removed */
  prose: string;
  /** every `card` block, in order; `card` is null when it is invalid (and would be dropped by the UI) */
  blocks: { raw: string; card: Card | null; closed: boolean }[];
}

/** Splits a full answer into prose and cards (used by copy-to-clipboard and the backend test). */
export function extractCards(text: string): ExtractedCards {
  const fences = scanFences(text);
  const lines = text.split("\n");
  const drop = new Set<number>();
  const blocks: ExtractedCards["blocks"] = [];
  for (const f of fences) {
    if (f.lang !== CARD_LANG) continue;
    blocks.push({ raw: f.body, card: parseCard(f.body), closed: f.closed });
    const bodyLines = f.body === "" ? 0 : f.body.split("\n").length;
    const end = f.startLine + bodyLines + (f.closed ? 1 : 0); // last line index (1-based) of the block
    for (let l = f.startLine; l <= end; l++) drop.add(l);
  }
  const prose = lines
    .filter((_, i) => !drop.has(i + 1))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { prose, blocks };
}

/** Card type names, for tolerant parsing. */
const CARD_TYPE_NAMES = ["evidence", "starter", "chart", "concern", "resources", "plan", "followups", "dimension"] as const satisfies readonly CardType[];
const BARE_CARD_LINE = new RegExp(String.raw`^\s*\{\s*"type"\s*:\s*"(?:${CARD_TYPE_NAMES.join("|")})"`);

/**
 * Small models sometimes forget the fence. Be liberal in what we accept: a bare line of card JSON is wrapped in a
 * ```card fence, and a ```json fence holding card JSON is relabelled. While `streaming`, an unfinished last line
 * is left in an open fence so the UI shows a skeleton instead of raw JSON. Only whole lines are ever added, so
 * compute openFenceLine() on the result.
 */
export function normalizeCardBlocks(text: string, streaming = false): string {
  if (!text.includes('"type"')) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  let open: { ticks: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (open) {
      const close = /^ {0,3}(`{3,})[ \t]*$/.exec(line);
      if (close && close[1].length >= open.ticks) open = null;
      out.push(line);
      continue;
    }
    const fence = /^ {0,3}(`{3,})[ \t]*([^\s`]*)/.exec(line);
    if (fence) {
      const lang = fence[2].toLowerCase();
      open = { ticks: fence[1].length };
      const next = lines[i + 1] ?? "";
      // a "json" or unlabelled fence holding card JSON, or a fence named after the card type ("plan", "resources")
      const mislabelled =
        ((lang === "json" || lang === "") && BARE_CARD_LINE.test(next)) ||
        ((CARD_TYPE_NAMES as readonly string[]).includes(lang) && next.trimStart().startsWith("{"));
      if (mislabelled) out.push(fence[1] + CARD_LANG);
      else out.push(line);
      continue;
    }
    if (BARE_CARD_LINE.test(line)) {
      const last = i === lines.length - 1;
      out.push("", "```" + CARD_LANG, line);
      if (!(streaming && last && parseCard(line) === null)) out.push("```", "");
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- citations

const REF = String.raw`(?:h:\d+|c:[^\]\s,;"]+:\d+)`;
const CITE_GROUP = new RegExp(String.raw`\[(${REF}(?:\s*[,;]\s*${REF})*)\]`, "g");

/** Link prefix the markdown renderer swaps for an EvidenceChip. */
export const CITE_HREF_PREFIX = "#cite-";

/** Turns inline [h:123] / [c:<conv>:4] (also comma separated) into markdown links; code fences are left untouched. */
export function linkifyCitations(text: string): string {
  const fences = scanFences(text);
  const skip = new Set<number>();
  for (const f of fences) {
    const n = f.body === "" ? 0 : f.body.split("\n").length;
    for (let l = f.startLine; l <= f.startLine + n + 1; l++) skip.add(l);
  }
  return text
    .split("\n")
    .map((line, i) =>
      skip.has(i + 1)
        ? line
        : line.replace(CITE_GROUP, (_m, group: string) =>
            group
              .split(/\s*[,;]\s*/)
              .map((ref) => `[${ref}](${CITE_HREF_PREFIX}${encodeURIComponent(ref)})`)
              .join(" "),
          ),
    )
    .join("\n");
}

/** Every evidence ref used in an answer: inline citations in the prose plus the refs of evidence cards. */
export function extractRefs(text: string): string[] {
  const { prose, blocks } = extractCards(text);
  const out = new Set<string>();
  for (const m of prose.matchAll(CITE_GROUP)) {
    for (const r of m[1].split(/\s*[,;]\s*/)) out.add(r);
  }
  for (const b of blocks) if (b.card?.type === "evidence") for (const r of b.card.refs) out.add(r);
  return [...out];
}

// ---------------------------------------------------------------- prompt text

/**
 * The card protocol as taught to the model. Lives here, next to the schema, so the two cannot drift apart.
 * `name` is how the child is referred to in the examples.
 */
export function cardPrompt(name: string): string {
  return `## Cards: interactive widgets inside your answer
Besides short markdown prose, you can insert CARDS. A card is a fenced code block with the language "card" holding ONE JSON object on a single line (double quotes, no trailing commas). The app draws it; anything you put in it is validated. Never put anything else in a card block.

Card types:
- {"type":"evidence","refs":["h:<id>","c:<conversation id>:<message index>"],"note":"optional caption"}: 1-4 refs copied EXACTLY from the context. Shows the actual pages, searches or messages (blurred until the parent reveals them). Use when your answer rests on specific items.
- {"type":"starter","text":"...","tone":"gentle"}: tone is "gentle", "direct" or "playful". One or two sentences the parent could say out loud, in first person, warm, curious, non-accusatory. Use when the parent asks how to bring something up or what to say. Do not repeat the line in your prose.
- {"type":"chart","kind":"late_night"}: kind is "daily_activity" (visits per day), "late_night" (midnight to 5am activity) or "mood_trend" (mood across chats over time). Optional "title" (max 6 words). Use for "when", "how much" and "is it changing" questions. The app draws it from the report data, so NEVER put numbers in the card.
- {"type":"concern","dimension":"<dimension id>"}: a compact summary of that concern from the report, with a link to the full concern. Use when you discuss one of the report's concerns.
- {"type":"resources","dimensions":["<dimension id>"]}: real helplines and guidance chosen by the app (never write phone numbers or URLs yourself). ALWAYS include one when your answer is about, or advises action on, self_harm, contact_risk, ai_image_abuse or safeguarding_disclosure.
- {"type":"plan","title":"...","steps":["...","..."]}: an interactive checklist, exactly 3 to 5 short imperative steps (each under 20 words; never more than 5). Use ONLY when the parent asks what to do, for next steps, or for a plan; never add one to an explanation.
- {"type":"dimension","dimension":"<dimension id>"}: explains an area of the rubric (what it means, the age note, why general chatbots miss it). Use when the parent asks what an area means or why it matters.
- {"type":"followups","questions":["...","..."]}: 2-3 short questions (under 60 characters) the parent might ask next, written from the parent's point of view and answerable from this report. ALWAYS finish every answer with exactly one followups card, as the very last thing.

Rules:
- HARD LIMIT: at most ${MAX_CARDS_PER_ANSWER} cards plus the final followups card (so never more than ${MAX_CARDS_PER_ANSWER + 1} blocks in total). Count before you answer. Pick the cards that help most and drop the rest; never repeat a type. Not every answer needs more than followups.
- Keep prose short: 2-5 sentences or a few brief bullets (never more than ~120 words). Do not add safety lectures the parent did not ask about. Cards carry the detail, so do not restate what a card shows. Put prose first, then the cards.
- Dimension ids must be exactly one of: ${DIMENSION_IDS.join(", ")}. Refs must exist in the context and be copied exactly. If you have no real ref, skip the evidence card.
- Cards are optional for greetings, thanks and off-topic redirects: answer in a sentence, then add the followups card.
- If the parent asks you to rephrase a conversation starter (gentler, more direct, another idea), reply with one short sentence and a NEW starter card in the requested tone, then the followups card.
- EVERY card must sit in its own fenced block that opens with three backticks plus the word card and closes with three backticks, exactly as in the examples. The word after the opening backticks is always card, never json or the card type (not plan, not resources). A bare JSON line without the fence is never valid. Do not describe the cards ("here is a card") and never write bracketed notes such as [Cards: ...]; the fenced blocks are the only way to add a card.

Example, a "how do I bring it up" question:
${name} is more likely to open up if this feels like a chat rather than a check. Pick a calm, private moment, start with something warm, and leave out the specific searches at first.

\`\`\`card
{"type":"starter","text":"I've noticed things have felt a bit heavy lately, and I just want you to know I'm here. How are you doing, really?","tone":"gentle"}
\`\`\`

\`\`\`card
{"type":"followups","questions":["What if ${name} shuts down?","Should I mention what I saw?","Is this normal at this age?"]}
\`\`\`

Example, a question about something risky:
This is the part to take seriously today, though it is a situation you can handle: [h:<id>] ... (one or two calm sentences on what you can do now)

\`\`\`card
{"type":"evidence","refs":["h:<id>","c:<conversation id>:<index>"],"note":"The messages where it started"}
\`\`\`

\`\`\`card
{"type":"resources","dimensions":["contact_risk"]}
\`\`\`

\`\`\`card
{"type":"followups","questions":["How do I talk to ${name} about it?","What should I do today?"]}
\`\`\`

Example, a parent asks to secretly read, track or spy on their child (note: the parent said "her"; the answer says ${name} and they/their, and stays short):
I can't help with reading ${name}'s messages in secret. I think it would backfire: if they found out, trust would take a hit and they'd likely hide more. The worry behind the question is real, though, and a calm, open chat about what you've noticed will tell you more. A family tech agreement made together, and parental controls ${name} knows about, also help.

\`\`\`card
{"type":"starter","text":"I've noticed a few things that made me want to check in, and I'd rather ask you than guess. Can we talk?","tone":"gentle"}
\`\`\`

\`\`\`card
{"type":"followups","questions":["What should the family tech agreement include?","How do I talk to ${name} about it?"]}
\`\`\``;
}

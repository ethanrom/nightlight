// AI chat history: ChatGPT / Claude data exports (conversations.json) and pasted transcripts.
import type { ChatMessage, Conversation, ParsedChats } from "../types";
import { hashString, toMs } from "./util";

const BAD_CHATGPT = "This doesn't look like a ChatGPT export. Upload the \"conversations.json\" file from the ChatGPT data export.";
const BAD_CLAUDE = "This doesn't look like a Claude export. Upload the \"conversations.json\" file from the Claude data export.";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Some exports wrap the array, e.g. {"conversations":[...]}. */
function unwrapList(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (isObj(json) && Array.isArray(json.conversations)) return json.conversations as unknown[];
  return null;
}

export function isChatGptShape(json: unknown): boolean {
  const list = unwrapList(json);
  if (!list) return false;
  const first = list.find(isObj);
  return !!first && isObj(first.mapping);
}

export function isClaudeShape(json: unknown): boolean {
  const list = unwrapList(json);
  if (!list) return false;
  const first = list.find(isObj);
  return !!first && Array.isArray(first.chat_messages);
}

// ------------------------------------------------------------------ ChatGPT

function chatGptText(content: unknown): string {
  if (!isObj(content)) return "";
  const parts = content.parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p): p is string => typeof p === "string")
      .join("\n")
      .trim();
  }
  // Rare: content_type "text" with a bare string
  if (typeof content.text === "string" && content.content_type === "text") return content.text.trim();
  return "";
}

function walkCurrentPath(mapping: Json, currentNode: unknown): Json[] {
  const path: Json[] = [];
  const seen = new Set<string>();
  let id: string | null = typeof currentNode === "string" && mapping[currentNode] ? currentNode : null;

  if (!id) {
    // No (valid) current_node: take the leaf with the latest message.
    let best: { id: string; t: number } | null = null;
    for (const [k, v] of Object.entries(mapping)) {
      if (!isObj(v)) continue;
      const kids = Array.isArray(v.children) ? v.children : [];
      if (kids.length > 0) continue;
      const msg = isObj(v.message) ? v.message : null;
      const t = msg && typeof msg.create_time === "number" ? msg.create_time : 0;
      if (!best || t >= best.t) best = { id: k, t };
    }
    id = best?.id ?? null;
  }

  while (id && !seen.has(id)) {
    seen.add(id);
    const node = mapping[id];
    if (!isObj(node)) break;
    path.push(node);
    id = typeof node.parent === "string" ? node.parent : null;
  }
  return path.reverse();
}

export function parseChatGptJson(json: unknown): ParsedChats {
  const list = unwrapList(json);
  if (!list) throw new Error(BAD_CHATGPT);

  const conversations: Conversation[] = [];
  for (const c of list) {
    if (!isObj(c) || !isObj(c.mapping)) continue;
    const nodes = walkCurrentPath(c.mapping, c.current_node);
    const messages: ChatMessage[] = [];
    for (const node of nodes) {
      const msg = isObj(node.message) ? node.message : null;
      if (!msg) continue;
      const role = isObj(msg.author) ? msg.author.role : undefined;
      if (role !== "user" && role !== "assistant") continue;
      const meta = isObj(msg.metadata) ? msg.metadata : {};
      if (meta.is_visually_hidden_from_conversation === true || meta.is_user_system_message === true) continue;
      // Tool calls (browsing, code interpreter, ...) are addressed to something other than the user.
      if (typeof msg.recipient === "string" && msg.recipient !== "all") continue;
      const text = chatGptText(msg.content);
      if (!text) continue;
      const ts = toMs(typeof msg.create_time === "number" ? msg.create_time : null);
      messages.push({ role: role === "user" ? "child" : "ai", text, ...(ts != null ? { ts } : {}) });
    }
    if (messages.length === 0) continue;
    const startedAt = toMs(typeof c.create_time === "number" ? c.create_time : null) ?? messages[0].ts;
    const rawId =
      (typeof c.id === "string" && c.id) || (typeof c.conversation_id === "string" && c.conversation_id) || "";
    const title = typeof c.title === "string" && c.title.trim() ? c.title.trim() : "Untitled chat";
    conversations.push({
      id: rawId || `chatgpt-${hashString(title + (startedAt ?? "") + messages[0].text)}`,
      platform: "ChatGPT",
      title,
      ...(startedAt != null ? { startedAt } : {}),
      messages,
    });
  }
  return { source: "chatgpt", label: "ChatGPT export", conversations };
}

export function parseChatGpt(text: string): ParsedChats {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(BAD_CHATGPT);
  }
  return parseChatGptJson(json);
}

// ------------------------------------------------------------------ Claude

function claudeText(m: Json): string {
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  if (Array.isArray(m.content)) {
    return m.content
      .map((b) => (isObj(b) && b.type === "text" && typeof b.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

export function parseClaudeJson(json: unknown): ParsedChats {
  const list = unwrapList(json);
  if (!list) throw new Error(BAD_CLAUDE);

  const conversations: Conversation[] = [];
  for (const c of list) {
    if (!isObj(c) || !Array.isArray(c.chat_messages)) continue;
    const messages: ChatMessage[] = [];
    for (const m of c.chat_messages) {
      if (!isObj(m)) continue;
      const sender = m.sender ?? m.role;
      if (sender !== "human" && sender !== "assistant" && sender !== "user") continue;
      const text = claudeText(m);
      if (!text) continue;
      const ts = toMs(m.created_at);
      messages.push({ role: sender === "assistant" ? "ai" : "child", text, ...(ts != null ? { ts } : {}) });
    }
    if (messages.length === 0) continue;
    const startedAt = toMs(c.created_at) ?? messages[0].ts;
    const name = typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Untitled chat";
    const id = (typeof c.uuid === "string" && c.uuid) || `claude-${hashString(name + (startedAt ?? "") + messages[0].text)}`;
    conversations.push({
      id,
      platform: "Claude",
      title: name,
      ...(startedAt != null ? { startedAt } : {}),
      messages,
    });
  }
  return { source: "claude", label: "Claude export", conversations };
}

export function parseClaude(text: string): ParsedChats {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(BAD_CLAUDE);
  }
  return parseClaudeJson(json);
}

// ------------------------------------------------------------------ pasted transcripts

const CHILD_ALIASES = new Set(["you", "me", "user", "human"]);
/** Speaker names that clearly belong to the AI side. */
const AI_NAME = /\b(ai|bot|assistant|chatgpt|gemini|claude|copilot|replika|character|grok|llama)\b/i;
const LEADING_TIMESTAMP = /^\s*\[?\(?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\)?\]?\s*[-–—]?\s*/;
const SPEAKER_LINE = /^\s*([^:：\n]{1,40}?)\s*[:：]\s*(.*)$/;

interface RawLine {
  speaker: string | null;
  text: string;
}

function normName(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function looksLikeSpeaker(name: string) {
  if (!name || /^https?$/i.test(name)) return false;
  if (/[/\\@]/.test(name) || /\d{3,}/.test(name)) return false;
  return name.split(/\s+/).length <= 4;
}

/** Strip decorations like "**Maya**" or "[Kai]" around a speaker name. */
function cleanSpeaker(raw: string) {
  return raw.replace(/^[\s*_[(<]+|[\s*_\])>]+$/g, "").trim();
}

/**
 * What parseTranscript returns: ONE Conversation (id, platform, title, messages) that is also shaped like a
 * ParsedChats ({source, label, conversations:[thatConversation]}), so callers can use whichever they need,
 * e.g. `parsed.push({ kind: "chats", fileName, data: parseTranscript(...) })`.
 */
export type TranscriptResult = Conversation & ParsedChats;

export function parseTranscript(text: string, platform: string, childName?: string): TranscriptResult {
  const src = text.replace(/\r\n?/g, "\n");
  const lines = src.split("\n");

  // Pass 1: find candidate "Name: message" lines.
  const parsed: { speaker: string | null; text: string; raw: string }[] = lines.map((raw) => {
    const stripped = raw.replace(LEADING_TIMESTAMP, "");
    const m = SPEAKER_LINE.exec(stripped);
    if (m) {
      const name = cleanSpeaker(m[1]);
      if (looksLikeSpeaker(name)) return { speaker: name, text: m[2], raw };
    }
    return { speaker: null, text: raw, raw };
  });

  const counts = new Map<string, number>();
  for (const p of parsed) if (p.speaker) counts.set(normName(p.speaker), (counts.get(normName(p.speaker)) ?? 0) + 1);

  const childNorm = childName ? normName(childName) : "";
  const isChildLike = (n: string) =>
    CHILD_ALIASES.has(n) || (!!childNorm && (n === childNorm || n.split(" ")[0] === childNorm.split(" ")[0]));

  // A speaker is "known" if it repeats, or is the child. This stops "Note: ..." inside a message from becoming a speaker.
  const known = new Set([...counts.entries()].filter(([n, c]) => c >= 2 || isChildLike(n)).map(([n]) => n));
  // Very short chats: a chat has (at least) two sides, so fill up with the earliest-appearing names.
  for (const n of counts.keys()) {
    if (known.size >= 2) break;
    known.add(n);
  }

  // Pass 2: group into messages.
  const raw: RawLine[] = [];
  const headerLines: string[] = [];
  for (const p of parsed) {
    if (p.speaker && known.has(normName(p.speaker))) {
      raw.push({ speaker: p.speaker, text: p.text.trim() });
    } else if (raw.length > 0) {
      raw[raw.length - 1].text += (raw[raw.length - 1].text ? "\n" : "") + p.raw.trimEnd();
    } else if (p.raw.trim()) {
      headerLines.push(p.raw.trim());
    }
  }
  const turns = raw
    .map((r) => ({ speaker: r.speaker as string, text: r.text.replace(/\n{3,}/g, "\n\n").trim() }))
    .filter((t) => t.text);

  if (turns.length === 0) {
    throw new Error(
      "We couldn't tell who is speaking in this chat. Paste it so each message starts with a name, like \"Maya: hello\" and \"Kai: hi there\".",
    );
  }

  // Decide which speaker is the child.
  const speakers: string[] = [];
  for (const t of turns) if (!speakers.some((s) => normName(s) === normName(t.speaker))) speakers.push(t.speaker);

  let child: string | undefined;
  if (childNorm) child = speakers.find((s) => isChildLike(normName(s)) && !CHILD_ALIASES.has(normName(s))) ;
  if (!child) child = speakers.find((s) => CHILD_ALIASES.has(normName(s)));
  if (!child) {
    const platformWords = normName(platform).split(" ").filter((w) => w.length > 2);
    const notAi = speakers.filter((s) => {
      const n = normName(s);
      return !AI_NAME.test(s) && !platformWords.some((w) => n === w || n.includes(w));
    });
    if (notAi.length === 1) child = notAi[0];
    else if (speakers.length === 2) child = turns[1]?.speaker ?? speakers[1];
    else if (notAi.length > 1) child = notAi.find((s) => normName(s) === normName(turns[1]?.speaker ?? "")) ?? notAi[notAi.length - 1];
    else child = turns[1]?.speaker ?? speakers[0];
  }
  const childKey = normName(child);

  const messages: ChatMessage[] = turns.map((t) => ({
    role: normName(t.speaker) === childKey ? "child" : "ai",
    text: t.text,
  }));

  const header = headerLines.find((l) => l.length <= 80);
  const conv: Conversation = {
    id: `transcript-${hashString(platform + "\n" + src)}`,
    platform,
    title: header ? header.replace(/^[#*\s]+|[*\s]+$/g, "") : `${platform} chat`,
    messages,
  };
  // (`conversations` holds a separate object, not the result itself, so the result stays JSON-serialisable)
  return { ...conv, source: "transcript", label: `${platform} transcript`, conversations: [conv] };
}

export function transcriptToParsedChats(conv: TranscriptResult): ParsedChats {
  return { source: "transcript", label: conv.label, conversations: conv.conversations };
}

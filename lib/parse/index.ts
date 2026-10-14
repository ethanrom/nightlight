// Entry point for the in-browser parsers: sniff the file's contents, then hand off to the right parser.
import type { ParsedFile } from "../types";
import { isChatGptShape, isClaudeShape, parseChatGptJson, parseClaudeJson, parseTranscript, transcriptToParsedChats } from "./chats";
import { looksLikeHistoryCsv, parseCsv } from "./csv";
import { parseSqliteHistory } from "./sqlite";
import { isTakeoutShape, parseTakeoutJson } from "./takeout";
import { decodeText, hasSqliteHeader } from "./util";

export { parseTranscript } from "./chats";

export const UNKNOWN_FILE_MESSAGE =
  "We couldn't recognise this file. Supported: Chrome/Edge/Firefox/Safari history, Google Takeout, CSV, ChatGPT or Claude exports.";

/** Guess the chat platform from a file name, e.g. "character-ai-chat.txt" -> "Character.AI". */
export function guessPlatformFromFileName(fileName: string): string {
  const n = fileName.toLowerCase();
  if (n.includes("character") || /\bc\.?ai\b/.test(n)) return "Character.AI";
  if (n.includes("replika")) return "Replika";
  if (n.includes("snap") || n.includes("myai") || n.includes("my-ai") || n.includes("my_ai")) return "Snapchat My AI";
  if (n.includes("chatgpt") || n.includes("openai")) return "ChatGPT";
  if (n.includes("gemini") || n.includes("bard")) return "Gemini";
  if (n.includes("claude")) return "Claude";
  if (n.includes("copilot")) return "Copilot";
  if (n.includes("janitor")) return "Janitor AI";
  if (n.includes("talkie")) return "Talkie";
  if (n.includes("polybuzz")) return "PolyBuzz";
  if (n.includes("chai")) return "Chai";
  return "AI chat";
}

function extension(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1].toLowerCase() : "";
}

/** Parse any supported upload. Throws an Error with a parent-readable message if it can't. */
export async function parseFile(fileName: string, bytes: Uint8Array): Promise<ParsedFile> {
  if (bytes.length === 0) throw new Error("This file is empty.");

  // 1) SQLite browser history (magic header "SQLite format 3\0")
  if (hasSqliteHeader(bytes)) {
    return { kind: "history", fileName, data: await parseSqliteHistory(bytes) };
  }

  // 2) Archives: a very common mistake with data exports
  if (bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new Error(
      "This looks like a .zip file. Please unzip it first and upload the file inside (for example \"conversations.json\" or \"BrowserHistory.json\"). " +
        UNKNOWN_FILE_MESSAGE,
    );
  }

  // 3) Text formats
  const text = decodeText(bytes);
  const trimmed = text.trimStart();
  const ext = extension(fileName);

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      json = undefined;
    }
    if (json !== undefined) {
      if (isTakeoutShape(json)) return { kind: "history", fileName, data: parseTakeoutJson(json) };
      if (isChatGptShape(json)) return { kind: "chats", fileName, data: parseChatGptJson(json) };
      if (isClaudeShape(json)) return { kind: "chats", fileName, data: parseClaudeJson(json) };
      throw new Error(UNKNOWN_FILE_MESSAGE);
    }
    // Not valid JSON: fall through (could be a transcript starting with "[12:03] ...")
  }

  if (ext === "txt" || ext === "text" || ext === "md") {
    const platform = guessPlatformFromFileName(fileName);
    const conv = parseTranscript(text, platform);
    return { kind: "chats", fileName, data: transcriptToParsedChats(conv) };
  }

  if (looksLikeHistoryCsv(text)) {
    return { kind: "history", fileName, data: parseCsv(text) };
  }

  throw new Error(UNKNOWN_FILE_MESSAGE);
}

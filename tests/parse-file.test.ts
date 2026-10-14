import path from "node:path";
import { describe, expect, it } from "vitest";
import { guessPlatformFromFileName, parseFile, parseTranscript } from "../lib/parse";
import { FIXTURES, SAMPLES, enc, readBytes } from "./helpers";

describe("parseFile sniffing", () => {
  it("sqlite: Chrome, Firefox and Safari by their tables, whatever the file name", async () => {
    const chrome = await parseFile("History", readBytes(path.join(SAMPLES, "History")));
    expect(chrome.kind).toBe("history");
    if (chrome.kind === "history") expect(chrome.data.source).toBe("chrome");

    const ff = await parseFile("renamed.bin", readBytes(path.join(FIXTURES, "places.sqlite")));
    if (ff.kind === "history") expect(ff.data.source).toBe("firefox");
    else throw new Error("expected history");

    const safari = await parseFile("History.db", readBytes(path.join(FIXTURES, "History.db")));
    if (safari.kind === "history") expect(safari.data.source).toBe("safari");
    else throw new Error("expected history");
  });

  it("Google Takeout JSON", async () => {
    const f = await parseFile("BrowserHistory.json", readBytes(path.join(SAMPLES, "BrowserHistory.json")));
    expect(f.kind).toBe("history");
    if (f.kind === "history") expect(f.data.source).toBe("takeout");
  });

  it("CSV with a url column", async () => {
    const f = await parseFile("export.csv", enc("URL,Title,Date\nhttps://a.example/,A,2026-10-05T10:00:00\n"));
    expect(f.kind).toBe("history");
    if (f.kind === "history") {
      expect(f.data.source).toBe("csv");
      expect(f.data.visits).toHaveLength(1);
    }
  });

  it("ChatGPT export", async () => {
    const f = await parseFile("conversations.json", readBytes(path.join(SAMPLES, "chatgpt-conversations.json")));
    expect(f.kind).toBe("chats");
    if (f.kind === "chats") {
      expect(f.data.source).toBe("chatgpt");
      expect(f.data.conversations).toHaveLength(15);
    }
  });

  it("Claude export", async () => {
    const json = [{ uuid: "u1", name: "Hi", created_at: "2026-10-01T10:00:00Z", chat_messages: [{ sender: "human", text: "hello", created_at: "2026-10-01T10:00:00Z" }, { sender: "assistant", text: "hi!", created_at: "2026-10-01T10:00:05Z" }] }];
    const f = await parseFile("conversations.json", enc(JSON.stringify(json)));
    expect(f.kind).toBe("chats");
    if (f.kind === "chats") expect(f.data.source).toBe("claude");
  });

  it(".txt is a transcript; the platform is guessed from the file name", async () => {
    const f = await parseFile("characterai-transcript.txt", readBytes(path.join(SAMPLES, "characterai-transcript.txt")));
    expect(f.kind).toBe("chats");
    if (f.kind === "chats") {
      expect(f.data.source).toBe("transcript");
      expect(f.data.conversations).toHaveLength(1);
      expect(f.data.conversations[0].platform).toBe("Character.AI");
    }
    const g = await parseFile("chat.txt", enc("Me: hi\nBot: hello\nMe: bye"));
    if (g.kind === "chats") expect(g.data.conversations[0].platform).toBe("AI chat");
    expect(guessPlatformFromFileName("Replika_export.txt")).toBe("Replika");
    expect(guessPlatformFromFileName("my-ai-snapchat.txt")).toBe("Snapchat My AI");
  });

  it("is re-exporting parseTranscript", () => {
    expect(parseTranscript("Me: hi\nBot: yo", "AI chat").messages).toHaveLength(2);
  });

  it("throws a friendly message for anything else", async () => {
    await expect(parseFile("photo.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).rejects.toThrow(/couldn't recognise this file/i);
    await expect(parseFile("random.json", enc('{"hello":"world"}'))).rejects.toThrow(/Supported: Chrome\/Edge\/Firefox\/Safari history, Google Takeout, CSV, ChatGPT or Claude exports/);
    await expect(parseFile("notes.docx", enc("some words, but no url column\nand more"))).rejects.toThrow(/couldn't recognise/i);
    await expect(parseFile("export.zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).rejects.toThrow(/zip/i);
    await expect(parseFile("empty.txt", new Uint8Array())).rejects.toThrow(/empty/i);
  });
});

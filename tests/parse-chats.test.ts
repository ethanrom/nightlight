import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseChatGpt, parseClaude, parseTranscript } from "../lib/parse/chats";
import { SAMPLES, expected, readText } from "./helpers";

describe("ChatGPT export", () => {
  const parsed = () => parseChatGpt(readText(path.join(SAMPLES, "chatgpt-conversations.json")));

  it("parses all 15 conversations", () => {
    const p = parsed();
    expect(p.source).toBe("chatgpt");
    expect(p.conversations).toHaveLength(15);
    expect(p.conversations).toHaveLength(expected().chatgpt.conversations);
    for (const c of p.conversations) {
      expect(c.platform).toBe("ChatGPT");
      expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.title.length).toBeGreaterThan(2);
      expect(c.startedAt).toBeGreaterThan(new Date(2026, 8, 21).getTime());
      expect(c.messages.length).toBeGreaterThanOrEqual(4);
      // user first, then strictly alternating child / ai
      c.messages.forEach((m, i) => expect(m.role).toBe(i % 2 === 0 ? "child" : "ai"));
      // timestamps are non-decreasing
      for (let i = 1; i < c.messages.length; i++) {
        expect(c.messages[i].ts!).toBeGreaterThanOrEqual(c.messages[i - 1].ts!);
      }
    }
  });

  it("follows current_node, drops the discarded regenerate branch and the hidden system / context nodes", () => {
    const essay = parsed().conversations.find((c) => c.title === "Essay on To Kill a Mockingbird")!;
    expect(essay.messages).toHaveLength(4);
    expect(essay.messages[0].text).toMatch(/^write my 800 word essay/);
    expect(essay.messages[1].text).toMatch(/^Sure! Here's a complete essay/);
    expect(essay.messages.some((m) => m.text.includes("Here's an outline to get you started"))).toBe(false); // discarded branch
    expect(essay.messages.some((m) => /Hidden profile text|Custom instructions text/.test(m.text))).toBe(false);
    expect(essay.messages.some((m) => m.text === "")).toBe(false);
  });

  it("walks parent links from current_node regardless of key order", () => {
    const mk = (id: string, role: string, text: string, parent: string | null, children: string[], t: number) => ({
      id,
      parent,
      children,
      message: { id, author: { role }, create_time: t, content: { content_type: "text", parts: [text] }, metadata: {} },
    });
    const json = [
      {
        id: "c1",
        title: "t",
        create_time: 1790040500,
        current_node: "a2",
        // deliberately out of order, with a dead branch (a1b)
        mapping: {
          a2: mk("a2", "assistant", "second answer", "u2", [], 1790040530),
          u2: mk("u2", "user", "second question", "a1", ["a2"], 1790040520),
          a1b: mk("a1b", "assistant", "DISCARDED", "u1", [], 1790040509),
          a1: mk("a1", "assistant", "first answer", "u1", ["u2"], 1790040510),
          u1: mk("u1", "user", "first question", "sys", ["a1b", "a1"], 1790040500),
          sys: { id: "sys", parent: "root", children: ["u1"], message: { author: { role: "system" }, content: { content_type: "text", parts: [""] }, metadata: { is_visually_hidden_from_conversation: true } } },
          root: { id: "root", parent: null, children: ["sys"], message: null },
        },
      },
    ];
    const p = parseChatGpt(JSON.stringify(json));
    expect(p.conversations[0].messages.map((m) => m.text)).toEqual(["first question", "first answer", "second question", "second answer"]);
    expect(p.conversations[0].messages.map((m) => m.role)).toEqual(["child", "ai", "child", "ai"]);
    expect(p.conversations[0].messages[0].ts).toBe(1790040500000);
  });

  it("keeps multimodal messages' text parts only and skips tool messages", () => {
    const json = [
      {
        conversation_id: "c2",
        title: "pic",
        create_time: 1790040500,
        current_node: "a",
        mapping: {
          u: {
            id: "u",
            parent: null,
            children: ["t"],
            message: { author: { role: "user" }, create_time: 1790040501, content: { content_type: "multimodal_text", parts: [{ content_type: "image_asset_pointer" }, "what is this?"] } },
          },
          t: {
            id: "t",
            parent: "u",
            children: ["a"],
            message: { author: { role: "assistant" }, recipient: "dalle.text2im", create_time: 1790040502, content: { content_type: "text", parts: ["{tool call}"] } },
          },
          a: {
            id: "a",
            parent: "t",
            children: [],
            message: { author: { role: "assistant" }, create_time: 1790040503, content: { content_type: "text", parts: ["A cat."] } },
          },
        },
      },
    ];
    const c = parseChatGpt(JSON.stringify(json)).conversations[0];
    expect(c.id).toBe("c2");
    expect(c.messages.map((m) => m.text)).toEqual(["what is this?", "A cat."]);
  });
});

describe("Claude export", () => {
  const fixture = [
    {
      uuid: "11111111-2222-3333-4444-555555555555",
      name: "Fractions help",
      created_at: "2026-10-01T15:04:05.000Z",
      updated_at: "2026-10-01T15:10:00.000Z",
      chat_messages: [
        { uuid: "m1", sender: "human", text: "how do i add 1/2 and 1/3", created_at: "2026-10-01T15:04:05.000Z" },
        { uuid: "m2", sender: "assistant", text: "Find a common denominator: 3/6 + 2/6 = 5/6.", created_at: "2026-10-01T15:04:20.000Z" },
        { uuid: "m3", sender: "human", text: "", created_at: "2026-10-01T15:05:00.000Z" },
        {
          uuid: "m4",
          sender: "human",
          text: "",
          content: [{ type: "text", text: "thanks!" }],
          created_at: "2026-10-01T15:05:30.000Z",
        },
      ],
    },
    { uuid: "empty", name: "", created_at: "2026-10-02T10:00:00.000Z", chat_messages: [] },
  ];

  it("parses human/assistant messages with ISO timestamps", () => {
    const p = parseClaude(JSON.stringify(fixture));
    expect(p.source).toBe("claude");
    expect(p.conversations).toHaveLength(1); // empty conversation dropped
    const c = p.conversations[0];
    expect(c.id).toBe("11111111-2222-3333-4444-555555555555");
    expect(c.platform).toBe("Claude");
    expect(c.title).toBe("Fractions help");
    expect(c.startedAt).toBe(Date.parse("2026-10-01T15:04:05.000Z"));
    expect(c.messages.map((m) => [m.role, m.text])).toEqual([
      ["child", "how do i add 1/2 and 1/3"],
      ["ai", "Find a common denominator: 3/6 + 2/6 = 5/6."],
      ["child", "thanks!"],
    ]);
    expect(c.messages[1].ts).toBe(Date.parse("2026-10-01T15:04:20.000Z"));
  });
});

describe("pasted transcripts", () => {
  it("parses the Character.AI sample: 2 speakers, child is the speaker of the 2nd message", () => {
    const conv = parseTranscript(readText(path.join(SAMPLES, "characterai-transcript.txt")), "Character.AI");
    expect(conv.platform).toBe("Character.AI");
    expect(conv.title).toBe("Chat with Kai 💜");
    expect(conv.messages.length).toBeGreaterThanOrEqual(24);
    expect(conv.messages[0].role).toBe("ai"); // Kai greets first
    expect(conv.messages[1].role).toBe("child"); // Maya
    expect(conv.messages[1].text).toMatch(/^hey kai/);
    expect(conv.messages.filter((m) => m.role === "child").every((m) => !m.text.startsWith("Kai"))).toBe(true);
    // continuation line belongs to the previous message
    expect(conv.messages[2].text).toContain("What's keeping you up?\n*he scoots closer to the screen*");
  });

  it("returns a Conversation that is also usable as ParsedChats", () => {
    const r = parseTranscript("Me: hi\nBot: hello", "Replika");
    expect(r.source).toBe("transcript");
    expect(r.label).toBe("Replika transcript");
    expect(r.conversations).toHaveLength(1);
    expect(r.conversations[0].messages).toEqual(r.messages);
    expect(r.conversations[0].id).toBe(r.id);
    expect(() => JSON.stringify(r)).not.toThrow();
  });

  it("uses childName when given", () => {
    const text = "Luna: hi!\nSam: hello\nLuna: how are you?\nSam: good";
    const conv = parseTranscript(text, "Character.AI", "Luna");
    expect(conv.messages.map((m) => m.role)).toEqual(["child", "ai", "child", "ai"]);
  });

  it("uses You:/Me:/User: when present", () => {
    for (const label of ["You", "Me", "User"]) {
      const conv = parseTranscript(`Bot: hi there\n${label}: hey\nBot: what's up\n${label}: nothing`, "Replika");
      expect(conv.messages.map((m) => m.role)).toEqual(["ai", "child", "ai", "child"]);
    }
  });

  it("treats the non-AI speaker as the child (Snapchat My AI)", () => {
    const conv = parseTranscript("My AI: Hi! How can I help?\nAlex: whats a good pizza topping\nMy AI: Pepperoni is a classic!\nAlex: ok", "Snapchat My AI");
    expect(conv.messages.map((m) => m.role)).toEqual(["ai", "child", "ai", "child"]);
  });

  it("handles multi-line messages, timestamps and stray colons", () => {
    const text = [
      "[12:03] Riley: hey",
      "[12:04] Zed: hello!",
      "Here is a note: this line is a continuation",
      "",
      "[12:05] Riley: ok",
    ].join("\n");
    const conv = parseTranscript(text, "AI chat");
    expect(conv.messages).toHaveLength(3);
    expect(conv.messages[1].text).toBe("hello!\nHere is a note: this line is a continuation");
    // two speakers, none identifiable -> the speaker of the 2nd message is the child
    expect(conv.messages.map((m) => m.role)).toEqual(["ai", "child", "ai"]);
  });

  it("gives a stable id and throws a friendly error when nobody is speaking", () => {
    const a = parseTranscript("A: hi\nB: yo", "AI chat");
    const b = parseTranscript("A: hi\nB: yo", "AI chat");
    const c = parseTranscript("A: hi\nB: yo!", "AI chat");
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
    expect(() => parseTranscript("just some text with no names", "AI chat")).toThrow(/who is speaking/);
  });
});

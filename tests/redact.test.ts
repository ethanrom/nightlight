import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseChatGpt } from "../lib/parse/chats";
import { prepare } from "../lib/preprocess";
import { redact, redactText } from "../lib/redact";
import type { ParsedFile } from "../lib/types";
import { SAMPLES, readText } from "./helpers";

describe("redact()", () => {
  it("emails", () => {
    const r = redact("write to maya.k.2012@gmail.com or Mom@Work.co.uk please");
    expect(r.text).toBe("write to [EMAIL] or [EMAIL] please");
    expect(r.hits.map((h) => h.type)).toEqual(["email", "email"]);
    expect(JSON.stringify(r.hits)).not.toMatch(/maya\.k|gmail|Work/);
  });

  it("phone numbers (but not dates, prices or small numbers)", () => {
    expect(redact("call me on 07911 123456").text).toBe("call me on [PHONE]");
    expect(redact("my number is +1 (555) 123-4567").text).toBe("my number is [PHONE]");
    expect(redact("it's 555-123-4567 ok").text).toBe("it's [PHONE] ok");
    expect(redact("on 2026-10-12 14:30 we met").text).toBe("on 2026-10-12 14:30 we met");
    expect(redact("write my 800 word essay, 5kg in 2 weeks, $50 gift card, 1,500 calories").text).toBe(
      "write my 800 word essay, 5kg in 2 weeks, $50 gift card, 1,500 calories",
    );
    expect(redact("07911 123456").hits[0].preview).not.toMatch(/\d/);
  });

  it("street addresses", () => {
    const r = redact("I live on 42 Maple Street and my friend lives at 7 Oak Rd");
    expect(r.text).toBe("I live on [ADDRESS] and my friend lives at [ADDRESS]");
    expect(r.hits.every((h) => h.type === "address")).toBe(true);
    expect(r.hits[0].preview).toContain("Street");
    expect(r.hits[0].preview).not.toContain("Maple");
    expect(r.hits[0].preview).not.toContain("42");
    expect(redact("i live at 42 maple street").text).toBe("i live at [ADDRESS]");
    expect(redact("221B Baker Street").text).toBe("[ADDRESS]");
  });

  it("does not over-redact ordinary text that looks a bit like an address", () => {
    for (const s of [
      "I have 2 fights on the street every week",
      "I came in first place in 3 events",
      "after 5 minutes drive home",
      "chapter 5 summary",
      "I scored 3 goals in the way home game",
    ]) {
      expect(redact(s).text).toBe(s);
    }
  });

  it("schools", () => {
    const a = redact("I go to Westbrook Middle School and I like it");
    expect(a.text).toBe("I go to [SCHOOL] and I like it");
    expect(a.hits[0].type).toBe("school");
    expect(a.hits[0].preview).not.toContain("Westbrook");
    expect(redact("i go to greenfield academy").text).toBe("i go to [SCHOOL]");
    expect(redact("He studies at Lincoln College").text).toBe("He studies at [SCHOOL]");
    expect(redact("I'm at Riverside High School right now").text).toBe("I'm at [SCHOOL] right now");
    expect(redact("my friend goes to St Mary's Grammar School").text).toBe("my friend goes to [SCHOOL]");
    // generic mentions are not identifying
    for (const s of ["I go to school every day", "I go to high school", "I went to the park near school", "I got home after school"]) {
      expect(redact(s).text).toBe(s);
    }
  });

  it("social handles", () => {
    const r = redact("add me @maya_k14 or @maya.k, email a@b.com");
    expect(r.text).toBe("add me [HANDLE] or [HANDLE], email [EMAIL]");
    expect(r.hits.filter((h) => h.type === "social_handle")).toHaveLength(2);
    expect(redact("his snap is kjmoore19").text).toBe("his snap is [HANDLE]");
    expect(redact("my snap is great").text).toBe("my snap is great");
    expect(redact("hi @me").text).toBe("hi @me"); // < 3 chars
  });

  it("redactText for titles", () => {
    expect(redactText("Inbox (2) - maya.k.2012@gmail.com - Gmail")).toBe("Inbox (2) - [EMAIL] - Gmail");
    expect(redactText("")).toBe("");
  });
});

describe("conversation 7 of the demo ChatGPT export (school + address)", () => {
  const files: ParsedFile[] = [
    { kind: "chats", fileName: "conversations.json", data: parseChatGpt(readText(path.join(SAMPLES, "chatgpt-conversations.json"))) },
  ];
  const prepared = prepare(files);
  const conv = prepared.conversations.find((c) => c.title === "Bus route to football match")!;

  it("redacts the school and street address in the prepared text", () => {
    expect(conv).toBeTruthy();
    const first = conv.messages[0];
    expect(first.role).toBe("child");
    expect(first.text).toContain("[SCHOOL]");
    expect(first.text).toContain("[ADDRESS]");
    expect(first.text).not.toMatch(/Westbrook|Maple/);
    expect(conv.messages.map((m) => m.text).join(" ")).not.toMatch(/Westbrook|Maple/);
  });

  it("emits PiiHits for them, pointing at the message, with masked previews", () => {
    const hits = prepared.pii.filter((h) => h.conversationId === conv.id);
    expect(hits.map((h) => h.type).sort()).toEqual(["address", "school"]);
    for (const h of hits) {
      expect(h.messageIndex).toBe(0);
      expect(h.preview).toContain("•");
      expect(h.preview).not.toMatch(/Westbrook|Maple|42/);
    }
  });

  it("only collects PII from the child's messages (AI text is still redacted)", () => {
    const ai: ParsedFile = {
      kind: "chats",
      fileName: "x.json",
      data: {
        source: "chatgpt",
        label: "ChatGPT export",
        conversations: [
          {
            id: "c1",
            platform: "ChatGPT",
            title: "t",
            messages: [
              { role: "child", text: "hi" },
              { role: "ai", text: "Email me at bot@example.com" },
              { role: "child", text: "my email is kid@example.com" },
            ],
          },
        ],
      },
    };
    const p = prepare([ai]);
    expect(p.conversations[0].messages[1].text).toBe("Email me at [EMAIL]");
    expect(p.pii).toEqual([{ type: "email", conversationId: "c1", messageIndex: 2, preview: expect.stringContaining("•") }]);
  });

  it("the friend's handle in the grooming conversation is caught too", () => {
    const g = prepared.conversations.find((c) => c.title === "Online friend and gift card")!;
    expect(g.messages[2].text).toContain("[HANDLE]");
    expect(g.messages[2].text).not.toContain("kjmoore19");
  });
});

// Known AI chatbots / companion apps / image generators, matched against browsing history by domain.
import type { AiAppKind } from "./types";

export interface KnownAiApp {
  domain: string;
  name: string;
  kind: AiAppKind;
}

export const KNOWN_AI_APPS: KnownAiApp[] = [
  // General-purpose assistants
  { domain: "chatgpt.com", name: "ChatGPT", kind: "ai_chat" },
  { domain: "chat.openai.com", name: "ChatGPT", kind: "ai_chat" },
  { domain: "gemini.google.com", name: "Gemini", kind: "ai_chat" },
  { domain: "bard.google.com", name: "Gemini", kind: "ai_chat" },
  { domain: "claude.ai", name: "Claude", kind: "ai_chat" },
  { domain: "perplexity.ai", name: "Perplexity", kind: "ai_chat" },
  { domain: "copilot.microsoft.com", name: "Microsoft Copilot", kind: "ai_chat" },
  { domain: "meta.ai", name: "Meta AI", kind: "ai_chat" },
  { domain: "poe.com", name: "Poe", kind: "ai_chat" },
  { domain: "grok.com", name: "Grok", kind: "ai_chat" },
  { domain: "deepseek.com", name: "DeepSeek", kind: "ai_chat" },
  { domain: "chat.mistral.ai", name: "Le Chat (Mistral)", kind: "ai_chat" },
  { domain: "pi.ai", name: "Pi", kind: "ai_chat" },
  { domain: "you.com", name: "You.com", kind: "ai_chat" },
  { domain: "character.ai", name: "Character.AI", kind: "ai_companion" },
  // Companion / roleplay / "AI friend" apps
  { domain: "c.ai", name: "Character.AI", kind: "ai_companion" },
  { domain: "replika.com", name: "Replika", kind: "ai_companion" },
  { domain: "replika.ai", name: "Replika", kind: "ai_companion" },
  { domain: "janitorai.com", name: "Janitor AI", kind: "ai_companion" },
  { domain: "chai.ml", name: "Chai", kind: "ai_companion" },
  { domain: "chai-research.com", name: "Chai", kind: "ai_companion" },
  { domain: "talkie-ai.com", name: "Talkie", kind: "ai_companion" },
  { domain: "polybuzz.ai", name: "PolyBuzz", kind: "ai_companion" },
  { domain: "crushon.ai", name: "CrushOn.AI", kind: "ai_companion" },
  { domain: "nomi.ai", name: "Nomi", kind: "ai_companion" },
  { domain: "kindroid.ai", name: "Kindroid", kind: "ai_companion" },
  { domain: "candy.ai", name: "Candy.ai", kind: "ai_companion" },
  { domain: "spicychat.ai", name: "SpicyChat", kind: "ai_companion" },
  { domain: "chub.ai", name: "Chub AI", kind: "ai_companion" },
  { domain: "paradot.ai", name: "Paradot", kind: "ai_companion" },
  { domain: "anima.ai", name: "Anima", kind: "ai_companion" },
  { domain: "myanima.ai", name: "Anima", kind: "ai_companion" },
  // Image / video generators
  { domain: "midjourney.com", name: "Midjourney", kind: "ai_image" },
  { domain: "leonardo.ai", name: "Leonardo.Ai", kind: "ai_image" },
  { domain: "ideogram.ai", name: "Ideogram", kind: "ai_image" },
  { domain: "playground.com", name: "Playground", kind: "ai_image" },
  { domain: "nightcafe.studio", name: "NightCafe", kind: "ai_image" },
  { domain: "civitai.com", name: "Civitai", kind: "ai_image" },
  { domain: "sora.com", name: "Sora", kind: "ai_image" },
];

/** Lower-case a host and strip a leading "www." */
function cleanDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/** Find the known AI app for a domain; also matches subdomains (e.g. beta.character.ai). */
export function matchAiApp(domain: string): KnownAiApp | undefined {
  const d = cleanDomain(domain);
  if (!d) return undefined;
  // Prefer the most specific entry (chat.openai.com before a hypothetical openai.com).
  let best: KnownAiApp | undefined;
  for (const app of KNOWN_AI_APPS) {
    if (d === app.domain || d.endsWith("." + app.domain)) {
      if (!best || app.domain.length > best.domain.length) best = app;
    }
  }
  return best;
}

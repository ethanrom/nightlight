// Sanity check: Bedrock credentials + inference profile + structured outputs.
// Run: npx tsx --env-file=.env.local scripts/smoke.ts
import { z } from "zod";
import { structured } from "../lib/llm";

const Schema = z.object({
  flags: z.array(
    z.object({
      id: z.number().int(),
      severity: z.enum(["normal", "worth_noticing", "talk_soon", "urgent"]),
      reason: z.string(),
    }),
  ),
});

async function main() {
const started = Date.now();
const out = await structured({
  schema: Schema,
  system:
    "You review a 14-year-old's browser history items for a parent. Return only items that a child-development expert would flag.",
  user: JSON.stringify([
    { id: 1, title: "Khan Academy – Quadratic equations" },
    { id: 2, title: "how to lose 5kg in 2 weeks - Google Search" },
    { id: 3, title: "Minecraft Wiki" },
  ]),
  maxTokens: 2000,
});
console.log(JSON.stringify(out, null, 2));
console.log(`OK in ${Date.now() - started}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

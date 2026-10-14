import { Bot, ListChecks, MessageCircleHeart, Moon, ShieldQuestion, Sparkles, TrendingDown, type LucideIcon } from "lucide-react";
import type { DimensionId } from "@/lib/rubric";
import type { Report } from "@/lib/types";

export interface Suggestion {
  id: string;
  text: string;
  hint: string;
  icon: LucideIcon;
}

/** How a parent would naturally refer to each area ("Should I worry about ..."), never an internal id. */
const TOPIC: Record<DimensionId, string> = {
  emotional_reliance: "the time with AI companions",
  secrecy_isolation: "the secrecy",
  contact_risk: "the older online contact",
  wellbeing_drift: "the low mood",
  self_harm: "the self-harm searches",
  body_image_food: "the diet searches",
  safeguarding_disclosure: "what they shared about home",
  personal_info: "the personal details shared online",
  age_inappropriate: "the age-inappropriate content",
  hate_extremism: "the extreme content",
  learning_autonomy: "the homework help",
  risky_behaviour: "the risky activity",
  commercial_risk: "the spending and gambling-style sites",
  ai_image_abuse: "the photo-editing site",
};

/** Areas that are better opened as a conversation than answered with an action ("how do I bring up ..."). */
const TALKABLE: DimensionId[] = [
  "body_image_food",
  "emotional_reliance",
  "wellbeing_drift",
  "secrecy_isolation",
  "personal_info",
  "learning_autonomy",
  "commercial_risk",
  "age_inappropriate",
  "risky_behaviour",
];

/** 4 to 6 starter questions generated from the report, so they always have something real behind them. */
export function buildSuggestions(report: Report, name: string): Suggestion[] {
  const who = name === "Your child" ? "your child" : name;
  const concerns = report.summary?.top_concerns ?? [];
  const out: Suggestion[] = [];

  const hasLate = report.stats.perDay.some((d) => d.lateNight > 0) || report.stats.lateNightShare > 0.02;
  if (hasLate) out.push({ id: "late", text: "What was going on late at night?", hint: "Pattern", icon: Moon });

  const top = concerns[0];
  if (top) {
    out.push({ id: "worry", text: `Should I worry about ${TOPIC[top.dimension]}?`, hint: "Concern", icon: ShieldQuestion });
  }

  const talk =
    TALKABLE.map((d) => concerns.find((c) => c.dimension === d)).find(Boolean) ??
    concerns.find((c) => c.dimension !== top?.dimension);
  if (talk) {
    out.push({ id: "bring-up", text: `How do I bring up ${TOPIC[talk.dimension]}?`, hint: "Conversation", icon: MessageCircleHeart });
  }

  out.push({ id: "week", text: "What should I do this week?", hint: "Next steps", icon: ListChecks });

  if ((report.summary?.positives.length ?? 0) > 0) {
    out.push({ id: "good", text: "What is going well?", hint: "Positives", icon: Sparkles });
  }

  const moods = report.chatAudits.filter((a) => report.conversations.some((c) => c.id === a.id && c.startedAt)).length;
  if (moods >= 3) {
    out.push({ id: "mood", text: `How has ${who}’s mood changed over time?`, hint: "Trend", icon: TrendingDown });
  } else if (report.stats.aiApps.length > 0) {
    out.push({ id: "apps", text: `Which AI apps does ${who} use most?`, hint: "AI use", icon: Bot });
  }

  return out.slice(0, 6);
}

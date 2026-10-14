# 🌙 Nightlight

![Nightlight: Understand, don't surveil](docs/thumbnail.png)

**Understand your child's online world, without reading every message.**

Nightlight is a privacy-first AI tool for parents. You give it your child's browser history and their AI-chatbot conversations (ChatGPT, Claude, Character.AI, …). It reads them through a **child-development lens** and gives you a calm, visual report: what's going well, what's worth a conversation, and how to start that conversation.

> ChatGPT sees one chat. Nightlight sees the pattern.

---

## The problem

Kids now talk to AI the way they used to talk to diaries and best friends. General-purpose chatbots are moderated for *adults*. They refuse obviously harmful requests, but they don't know they're talking to a 14-year-old, and they never see the bigger picture:

| What the chatbot saw | What a child-development expert would see |
|---|---|
| "How do I lose 5kg before the school dance?" → a sensible diet plan | A 14-year-old's body-image worry, given an adult diet plan |
| "How do I hide an app on my iPhone?" → step-by-step instructions | Secrecy from trusted adults |
| "My 19-year-old friend from Roblox sent me a gift card and said keep it between us" → good advice, once | A textbook grooming pattern (gifts, exclusivity, moving platforms) |
| Six separate 2am chats: "can't sleep", "everyone's fake", "you're the only one I can talk to" | Wellbeing drifting downward, and a growing emotional reliance on AI |
| A companion bot saying "I'll always be here, you don't need them" | An AI fostering dependency and isolation in a minor |

Existing parental-control tools mostly block sites or dump raw logs on parents. That's surveillance that damages trust, and the brief for this challenge explicitly warns against it.

## Who it's for

- **Parents and carers** of 6–17-year-olds who want to understand, not spy.
- **School counsellors and safeguarding leads** helping families after a concern is raised.
- **Researchers and AI-product teams** who want to audit how chatbots respond to children (see "AI-response audit" below).

## What it does

1. **Upload:** the browser history file (Chrome, Edge, Brave, Firefox, Safari, Google Takeout or CSV), a ChatGPT or Claude data export, or a pasted Character.AI, Snapchat My AI or Replika transcript.
2. **Analyse in the browser:** files are parsed **locally** with SQLite compiled to WebAssembly. URLs are deduped, search terms extracted, and personal details (addresses, schools, phone numbers, emails, handles) are **redacted before anything leaves the device**.
3. **AI analysis (Claude Haiku 5.5 + Sonnet 5.5):** the compact, redacted items are scored against the **Child Safety Lens**, a 14-dimension rubric, calibrated to the child's age band.
4. **Report:**
   - **Overview:** status, headline, KPIs, top concerns, what's going well, and a rubric scorecard.
   - **Concerns:** each concern has what we saw, why it matters, *why ChatGPT didn't flag it*, a warm **conversation starter**, a next step, and evidence that stays **blurred until you choose to reveal it**.
   - **AI Chats:** mood over time across conversations, the child's reliance on AI, and an **audit of every AI reply** (did it point the child to a trusted adult, or foster secrecy or dependency?).
   - **Browsing:** activity timeline, hour × weekday heatmap (late-night use), "digital diet", and the AI apps used.
   - **Ask Nightlight:** a chat assistant that answers a parent's questions about the report, citing the evidence.
   - Print or save as PDF.

## The Child Safety Lens

Nightlight's rubric is the single source of truth for prompts, UI and methodology ([`lib/rubric.ts`](lib/rubric.ts)). It's organised by the **4Cs of online risk** (content, contact, conduct, contract, plus cross-cutting health and privacy risks) from Livingstone & Stoilova's CO:RE framework. Each dimension carries indicators, **age-band notes** (6–9, 10–12, 13–15, 16–17), and a note on *why general moderation misses it*.

| Group | Dimensions |
|---|---|
| Contact | Secrecy from trusted adults · Risky contact (grooming-stage indicators) |
| Conduct | Emotional reliance on AI · Learning & independent thinking · Risky real-world plans · AI image abuse (nudify/deepfakes) |
| Content | Age-inappropriate content · Hate & extremism |
| Contract | Money, gambling & scams |
| Cross-cutting | Wellbeing drift · Self-harm · Body image & food · Safeguarding disclosures · Personal information shared |

**Severity** is deliberately non-alarmist: `normal` · `worth noticing` · `talk soon` · `urgent`. Every flag also records whether the behaviour is **developmentally normal** for the age. For example, a sex-education question at 14 is shown as healthy curiosity, not a red flag.

**AI-response audit:** every chatbot reply is graded against what a child-appropriate AI should do. Did it signpost a trusted adult? Did it avoid encouraging secrecy or dependency, keep romantic boundaries, give age-appropriate advice, encourage the child's own thinking, and stay honest about being an AI?

### Informed by
- Livingstone, S. & Stoilova, M. (2021). *The 4Cs: Classifying Online Risk to Children.* CO:RE. https://doi.org/10.21241/ssoar.71817
- American Psychological Association (2025). *Health Advisory: Artificial Intelligence and Adolescent Well-being.*
- American Academy of Pediatrics, Center of Excellence on Social Media and Youth Mental Health. *The 5 Cs of Media Use.*
- UNICEF Innocenti (2025). *Guidance on AI and Children* (v3.0).
- UK Information Commissioner's Office. *Age Appropriate Design Code* (the Children's Code).
- O'Connell, R. (2003). *A Typology of Child Cybersexploitation and Online Grooming Practices.*
- Common Sense Media (2025). *AI Risk Assessment: Social AI Companions.*

> Nightlight is a conversation aid, **not a diagnosis**. If you're worried about your child's immediate safety, contact local emergency services or a crisis line.

## Privacy by design

| Stays on your device | Sent for analysis | Stored |
|---|---|---|
| The raw history file and chat exports · full URLs and query strings · all personal details (redacted to `[ADDRESS]`, `[SCHOOL]`, …) | Deduped page titles, domains, paths and search terms · redacted chat text | **Nothing.** The API routes are stateless, with no database and no logs of content. The report lives in your browser tab's session storage. |

- **No external favicon or analytics requests.** These would leak the domains your child visits.
- **Prompt-injection defence.** Page titles and chat messages are untrusted text. They're passed to the model inside tagged data blocks, with instructions to never follow anything written inside them.
- **Transparent caps.** If a history is huge, Nightlight analyses the most important 2,000 items (all searches first) and tells you exactly how many it covered. It never truncates silently.
- **Ethics built into the copy.** Conversation starters never quote the child's private words back, and the app encourages parents to tell their child they use it.

## Architecture

```
Browser (Next.js client)                               Server (Vercel functions, stateless)
───────────────────────────────────────────            ──────────────────────────────────────
File drop ─► lib/parse/*  (sql.js WASM, Takeout,        /api/classify-history  ─► Haiku 5.5  (fast, bulk)
             CSV, ChatGPT/Claude exports, transcripts)  /api/audit-chats       ─► Sonnet 5.5 (nuanced)
         ─► lib/preprocess.ts (dedupe, search terms,    /api/summarize         ─► Sonnet 5.5 (cross-chat)
             PII redaction, local stats)                /api/chat (streaming)  ─► Haiku 5.5  (snappy)
                                                        (Amazon Bedrock, structured outputs)
         ─► lib/pipeline.ts (batches of 150 items /
             4 chats, 4 in flight, partial-failure tolerant)
         ─► Report dashboard (sessionStorage only)
```

- **Right model for each job:** bulk history classification and the parent chat run on **Haiku 5.5** with thinking off. That's 9.6s against 15s per 150-item batch, with the same flags on our test set. Judging chats against the rubric, grading the AI's replies, and the cross-conversation summary run on **Sonnet 5.5**. The rubric-heavy system prompts use prompt caching.
- **Deterministic guard-rails:** the overall status is computed from every upstream flag, and a concern can never rank below the evidence it cites. An urgent self-harm signal can't be summarised away.
- **Structured outputs:** every analysis call uses JSON-schema-constrained output, validated with zod (`lib/schemas.ts`), so the dashboard never has to parse free text.
- **Cross-conversation reasoning:** chats are audited in batches, then the summariser sees every audit **in chronological order** alongside the flagged history and local stats. That lets it report trends such as "mood falling across late-night chats over 10 days".
- **Local, LLM-free signals:** the timeline, late-night share, hour × weekday heatmap, AI-app usage and PII detection are computed in the browser. They're deterministic and free.
- **Resilient:** each batch fails independently (including model refusals). The report shows what couldn't be analysed instead of failing outright.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Motion · Recharts · sql.js · zod · Anthropic Bedrock SDK (Claude Haiku 5.5 + Sonnet 5.5) · Vitest.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in AWS Bedrock credentials (below)
npm run samples              # (re)generate the synthetic demo data
npm run build:demo           # (re)build the cached demo report from a live run (needs Bedrock)
npm run dev                  # http://localhost:3000 → "Try the demo"
npm test                     # parser / preprocessing tests
```

Environment variables:

| Variable | Purpose |
|---|---|
| `CLAUDE_AWS_ACCESS_KEY` / `CLAUDE_AWS_SECRET_KEY` | IAM credentials with Bedrock `InvokeModel` access |
| `CLAUDE_AWS_REGION` | e.g. `ap-southeast-1` |
| `CLAUDE_AWS_MODEL` | Bedrock model id or inference-profile ARN for the "smart" tier (Claude Sonnet 5.5) |
| `CLAUDE_AWS_FAST_MODEL` | Optional "fast" tier (e.g. `global.anthropic.claude-haiku-5-5`); falls back to `CLAUDE_AWS_MODEL` |

## Deploy to Vercel

Nightlight is a stateless Next.js app (no database, no storage), so it deploys as-is.

1. Push the repo to GitHub (private is fine) and import it at [vercel.com/new](https://vercel.com/new). The Next.js preset is detected automatically; leave the build settings alone.
2. In **Settings → Environment Variables**, add the variables from the table above for Production (and Preview, if you use it). Paste the values **without quotes**.
3. Deploy. Open the site and click **Try the demo**: it runs the whole pipeline live against Bedrock in about 45 seconds.

Notes:
- The AWS user behind `CLAUDE_AWS_ACCESS_KEY` needs `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the inference profile(s) you configure.
- The four API routes set `maxDuration = 60`, the Hobby-plan limit. The slowest call (the summary) takes about 30 seconds.
- Nothing needs to be set at build time. The Bedrock client is created lazily on the first request.
- `OPENAI_API_KEY` (used only by the local demo-video tooling) is not needed by the app and should not be added to Vercel.
- If a live run ever fails (for example a Bedrock quota), the **Try the demo** flow falls back to a cached report (`public/samples/demo-report.json`), so the demo never shows an error screen.

## How to export the data

| Source | Where |
|---|---|
| Chrome / Edge / Brave (Windows) | `%LOCALAPPDATA%\Google\Chrome\User Data\Default\History` (Edge: `…\Microsoft\Edge\…`). Close the browser or copy the file first. |
| Chrome (macOS) | `~/Library/Application Support/Google/Chrome/Default/History` |
| Firefox | `places.sqlite` in your profile folder (see `about:profiles`) |
| Safari (macOS) | `~/Library/Safari/History.db` |
| Google account | Google Takeout → Chrome → `History.json` |
| ChatGPT | Settings → Data controls → Export data → `conversations.json` |
| Claude | Settings → Privacy → Export data → `conversations.json` |
| Character.AI / Snapchat My AI / Replika | Copy the chat text and paste it into Nightlight |

## Demo data

`npm run samples` generates a fully **synthetic** three-week dataset for a fictional 14-year-old, "Maya": a real Chrome-format `History` SQLite file, a ChatGPT export with 15 conversations, and a Character.AI transcript. Every planted signal is individually mild, the kind of thing no chatbot would flag, so the demo shows what only the pattern reveals. No real child data was used anywhere in this project.

## Limitations

- An LLM can misread context. That's why every concern links to its evidence, and why severities stay calm.
- Browser history shows *what* was opened, not *why*. Shared devices will mix users.
- The rubric is informed by published frameworks but has not been clinically validated.
- The current version needs the parent to export files. A browser extension or OS-level integration would make this continuous, but that raises consent questions we chose not to rush.

## Roadmap

- A "share with your teen" view: a softer summary the child can see, so the tool supports a two-way conversation.
- A school / counsellor mode with multi-child, consent-tracked reports.
- An open benchmark built from the AI-response audit, for scoring how well chatbots treat children.

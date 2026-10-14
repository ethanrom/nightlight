# Hackathon submission: Nightlight

## Project name (max 60 characters)

Nightlight: Understand, don't surveil

## Elevator pitch (max 200 characters)

Chatbots only see one chat at a time. Nightlight reads a child's browsing and AI chats through a child-development lens, spots the patterns they miss, and helps parents start the conversation.

## Thumbnail (3:2)

[`docs/thumbnail.png`](thumbnail.png), 1500 × 1000.

## Project overview

**The problem.** Children now talk to AI the way they used to talk to a diary or a best friend. General-purpose chatbots are moderated for adults. They refuse obviously harmful requests, but they don't know they're talking to a 14-year-old, and they only ever see one conversation at a time. A diet plan, instructions for hiding an app from parents, or a gift card from an older "friend" on Roblox are each a normal request for an adult. For a child, each is a warning sign, and the real signal is the pattern across weeks: mood falling, chats drifting later into the night, growing reliance on an AI companion. Parental-control tools mostly block sites or dump raw logs on parents, which is surveillance that damages trust.

**What Nightlight does.** A parent uploads a child's browser history and AI-chat exports (ChatGPT, Claude, Character.AI and others). Everything is parsed in the browser and personal details are redacted on the device. Claude then analyses the redacted data against a 14-dimension "Child Safety Lens", built on the 4Cs of online risk and informed by the APA, AAP and UNICEF guidance, and calibrated to the child's age. The parent gets a calm report: what's going well, ranked concerns with a warm conversation starter for each, mood and reliance trends across conversations, an audit of how the AI itself responded to the child, and an "Ask Nightlight" assistant that answers questions from the report with cited evidence. Evidence stays blurred until the parent chooses to reveal it, and none of the child's data is stored.

**Target users.** Parents and carers of 6–17-year-olds who want to understand rather than spy; school counsellors and safeguarding leads supporting families; and AI-product teams who want to audit how chatbots respond to children.

**Why it matters.** It fills the gap between what chatbot moderation catches (explicit harm in one message) and what a child-development expert would notice (patterns over time and age-inappropriate answers). It supports the conversation between parent and child instead of replacing it, which is the intervention that actually keeps children safe.

**How AI is used.** Claude Haiku 5.5 classifies browsing history in bulk; Claude Sonnet 5.5 audits each conversation against the rubric, grades the AI's replies for a child audience, and reasons across conversations to find trends; Haiku powers the parent Q&A with computed, evidence-linked answers. All outputs are schema-constrained (structured outputs) and validated, prompts treat all child data as untrusted, and deterministic guard-rails ensure an urgent signal can never be summarised away.

**Measured, not just demoed.** We built a labelled synthetic test set: three weeks for a fictional 14-year-old, with 24 planted signals, 5 patterns that only exist across conversations, and 165 harmless items. We scored it against an answer key written before any model ran. OpenAI's own Moderation API caught 4 of the 24 signals, and its only false alarms flagged homework about *To Kill a Mockingbird* as violent. Nightlight caught 23 of 24, found all 5 cross-conversation patterns, raised no false alarms, and graded all 6 AI replies correctly, with 94% of verdicts identical across 3 runs. The app's /evaluation page shows every signal, every pattern and every miss.


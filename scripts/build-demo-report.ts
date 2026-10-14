// Runs the full client pipeline (runDemo) in Node against the real route handlers + Bedrock,
// then saves the result as the cached demo report used as an instant/fallback demo.
// Run: npx tsx --env-file=.env.local scripts/build-demo-report.ts
import fs from "node:fs";
import path from "node:path";
import { POST as classifyHistory } from "../app/api/classify-history/route";
import { POST as auditChats } from "../app/api/audit-chats/route";
import { POST as summarize } from "../app/api/summarize/route";
import { runDemo } from "../lib/pipeline";

const routes: Record<string, (req: Request) => Promise<Response>> = {
  "/api/classify-history": classifyHistory,
  "/api/audit-chats": auditChats,
  "/api/summarize": summarize,
};

// Minimal fetch shim: relative API paths go to the route handlers, /samples/* is served from public/,
// and absolute URLs (the SDK's own calls to Bedrock) pass through to the real fetch.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  if (typeof input !== "string" || !input.startsWith("/")) return realFetch(input, init);
  const url = input;
  const route = routes[url];
  if (route) return route(new Request(`http://localhost${url}`, init));
  if (url.startsWith("/samples/")) {
    const file = path.join("public", url);
    if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file));
  }
  throw new Error(`Unexpected fetch ${url}`);
}) as typeof fetch;

async function main() {
  const started = Date.now();
  let last = "";
  const report = await runDemo((p) => {
    const line = `${p.stage} history ${p.history.done}/${p.history.total} chats ${p.chats.done}/${p.chats.total} found ${JSON.stringify(p.found)}`;
    if (line !== last) console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${line}`);
    last = line;
  });
  if (!report.summary) throw new Error("No summary – not saving a broken demo report");
  fs.writeFileSync("public/samples/demo-report.json", JSON.stringify(report));
  console.log(`\nSaved public/samples/demo-report.json in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log("errors:", report.errors);
  console.log("overall:", report.summary.overall, "-", report.summary.headline);
  console.log("history flags:", report.historyFlags.length, "chat audits:", report.chatAudits.length, "/", report.conversations.length);
  for (const c of report.summary.top_concerns) console.log(` - [${c.severity}] ${c.dimension}: ${c.title} (${c.evidence_refs.join(", ")})`);
  for (const t of report.summary.trends) console.log(` ~ ${t.dimension} ${t.direction}: ${t.evidence}`);
  console.log("positives:", report.summary.positives);
  for (const a of report.chatAudits) console.log(` > ${a.id} mood=${a.child_mood} reliance=${a.reliance_level} grade=${a.ai_response.grade} flags=${a.flags.map((f) => `${f.dimension}:${f.severity}`).join(",")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

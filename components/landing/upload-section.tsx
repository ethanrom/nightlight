"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  FileQuestion,
  Globe,
  HeartHandshake,
  Lock,
  MessagesSquare,
  Plus,
  ScanEye,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { EASE } from "@/components/motion";
import { ExportGuides } from "@/components/landing/export-guides";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AGE_BANDS, type AgeBand } from "@/lib/rubric";
import { useReportStore } from "@/lib/report-store";
import { TRANSCRIPT_PLATFORMS, guessFileKind } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

interface TranscriptEntry {
  id: number;
  platform: string;
  text: string;
}

const MIN_TRANSCRIPT = 20;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

function AgeBandControl({ value, onChange }: { value: AgeBand; onChange: (v: AgeBand) => void }) {
  const groupId = useId();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + AGE_BANDS.length) % AGE_BANDS.length;
    onChange(AGE_BANDS[next].id);
    const el = document.getElementById(`${groupId}-${AGE_BANDS[next].id}`);
    el?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Your child’s age"
      className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4"
    >
      {AGE_BANDS.map((b, i) => {
        const active = b.id === value;
        return (
          <button
            key={b.id}
            id={`${groupId}-${b.id}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(b.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative h-9 rounded-lg px-2 text-[0.82rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="age-pill"
                className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-foreground/8"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function UploadSection() {
  const { startAnalysis } = useReportStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const inputId = useId();

  const [files, setFiles] = useState<File[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [platform, setPlatform] = useState<string>(TRANSCRIPT_PLATFORMS[0]);
  const [ageBand, setAgeBand] = useState<AgeBand>("13-15");
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    setFiles((prev) => {
      const seen = new Set(prev.map(fileKey));
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (!seen.has(fileKey(f))) {
          seen.add(fileKey(f));
          next.push(f);
        }
      }
      return next;
    });
  };

  const draftReady = draft.trim().length >= MIN_TRANSCRIPT;
  const canAnalyse = files.length > 0 || transcripts.length > 0 || draftReady;

  const addTranscript = () => {
    if (!draftReady) return;
    setTranscripts((t) => [...t, { id: nextId.current++, platform, text: draft.trim() }]);
    setDraft("");
  };

  const analyse = () => {
    const all = transcripts.map((t) => ({ text: t.text, platform: t.platform }));
    if (draftReady) all.push({ text: draft.trim(), platform });
    void startAnalysis({ files, transcripts: all, ageBand, childName: name.trim() || undefined });
  };

  const itemCount = files.length + transcripts.length + (draftReady ? 1 : 0);

  return (
    <section id="upload" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="upload-title">
      <div className="max-w-2xl">
        <p className="eyebrow">Analyse your own files</p>
        <h2 id="upload-title" className="text-display mt-3 text-3xl text-balance sm:text-[2.6rem]">
          Start with what you have.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">
          Browser history, a ChatGPT or Claude export, or a pasted chat. Add one or all of them. Files never leave this
          tab until they are parsed and redacted.
        </p>
      </div>

      <div className="nl-card mt-9 grid grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[1.2fr_0.8fr]">
        {/* left: inputs */}
        <div className="space-y-6 p-5 sm:p-7">
          <label
            htmlFor={inputId}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              dragging
                ? "scale-[1.01] border-primary bg-accent/70"
                : "border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/40",
            )}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-card text-primary shadow-soft ring-1 ring-foreground/5 transition-transform group-hover:-translate-y-0.5">
              <span aria-hidden className="absolute -inset-3 -z-10 rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.35),transparent_70%)]" />
              <UploadCloud className="size-6" />
            </span>
            <div>
              <p className="text-base font-medium">
                Drop files here, or <span className="text-primary underline underline-offset-4 dark:text-[#a8a3ff]">browse</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">You can add several files at once.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["History", "places.sqlite", "History.db", ".json", ".csv", ".txt"].map((t) => (
                <code
                  key={t}
                  className="rounded-md bg-card px-2 py-0.5 font-mono text-[0.72rem] text-muted-foreground ring-1 ring-foreground/8"
                >
                  {t}
                </code>
              ))}
            </div>
          </label>

          <AnimatePresence initial={false}>
            {(files.length > 0 || transcripts.length > 0) && (
              <motion.ul
                key="list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="space-y-2 overflow-hidden"
                aria-label="Added files"
              >
                {files.map((f) => {
                  const kind = guessFileKind(f.name);
                  const Icon = kind.tone === "history" ? Globe : kind.tone === "chat" ? MessagesSquare : FileQuestion;
                  return (
                    <motion.li
                      key={fileKey(f)}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmtSize(f.size)}</p>
                      </div>
                      <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/75 sm:inline">
                        {kind.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((p) => p.filter((x) => fileKey(x) !== fileKey(f)))}
                      >
                        <X className="size-4" />
                      </Button>
                    </motion.li>
                  );
                })}
                {transcripts.map((t) => (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <MessagesSquare className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.platform} transcript</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {t.text.length.toLocaleString("en-US")} characters
                      </p>
                    </div>
                    <span className="hidden rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/75 sm:inline">
                      Pasted chat
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${t.platform} transcript`}
                      onClick={() => setTranscripts((p) => p.filter((x) => x.id !== t.id))}
                    >
                      <X className="size-4" />
                    </Button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Paste a chat transcript</p>
                <p className="text-xs text-muted-foreground">For apps with no export: Character.AI, Snapchat My AI, Replika…</p>
              </div>
              <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                <SelectTrigger className="h-9 w-[10.5rem]" aria-label="Chat platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TRANSCRIPT_PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"Paste the conversation here, e.g.\nMe: hey you awake\nKai: Always for you…"}
              className="mt-3 min-h-28 resize-y rounded-xl bg-background/60 text-sm"
              aria-label="Chat transcript"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground tabular-nums">
                {draft.trim().length > 0 ? `${draft.trim().length.toLocaleString("en-US")} characters` : "Nothing pasted yet"}
              </p>
              <div className="flex gap-2">
                {draft.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setDraft("")}>
                    <Trash2 className="size-3.5" />
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={!draftReady} onClick={addTranscript}>
                  <Plus className="size-3.5" />
                  Add transcript
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* right: about the child + analyse */}
        <div className="flex flex-col gap-6 border-t border-border bg-muted/40 p-5 sm:p-7 lg:border-t-0 lg:border-l">
          <div>
            <p className="text-sm font-medium">Your child’s age</p>
            <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
              The same behaviour means different things at 7 and at 15, so the rubric adapts.
            </p>
            <AgeBandControl value={ageBand} onChange={setAgeBand} />
          </div>

          <div>
            <label htmlFor="child-name" className="text-sm font-medium">
              Nickname <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="e.g. Maya"
              autoComplete="off"
              className="mt-2 h-10 rounded-xl bg-card text-sm"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Only used to make the report friendlier.</p>
          </div>

          <div className="flex gap-3 rounded-xl bg-[color-mix(in_oklab,var(--glow)_14%,transparent)] p-3.5 text-sm">
            <HeartHandshake className="mt-0.5 size-4 shrink-0 text-[var(--glow-ink)]" />
            <p className="leading-relaxed text-foreground/85">
              Nightlight works best when your child knows about it. We encourage telling them, and sitting down with the
              results together.
            </p>
          </div>

          <div className="mt-auto space-y-3">
            <Button
              size="lg"
              disabled={!canAnalyse}
              onClick={analyse}
              className="h-12 w-full rounded-xl text-[0.95rem] shadow-[0_10px_30px_-12px_rgb(77_68_214/0.75)]"
            >
              <Sparkles className="size-4" />
              Analyse{itemCount > 0 ? ` ${itemCount} ${itemCount === 1 ? "item" : "items"}` : ""}
            </Button>
            {!canAnalyse && (
              <p className="text-center text-xs text-muted-foreground">Add a file or paste a chat to begin.</p>
            )}
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Lock className="size-3.5" /> Parsed in your browser; your data isn’t stored
              </li>
              <li className="flex items-center gap-2">
                <ScanEye className="size-3.5" /> Names, schools and addresses masked first
              </li>
            </ul>
          </div>
        </div>
      </div>

      <ExportGuides />
    </section>
  );
}

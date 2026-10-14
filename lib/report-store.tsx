"use client";

// Client state for the report and the analyse/demo flow.
// - The report lives in an external store backed by sessionStorage (survives refresh, cleared on "New analysis"
//   or when the tab closes). Nothing is ever sent to a server for storage.
// - `startAnalysis` / `startDemo` drive the pipeline, expose live progress for the analysing overlay and navigate
//   to /report when done.
// - In development ONLY, if the pipeline is still a stub ("not implemented"), we fall back to lib/mock-report.ts
//   after a short fake progress animation so the whole UI can be built and demoed.

import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CapacityError, loadCachedDemo, runDemo, runPipeline } from "./pipeline";
import type { AgeBand } from "./rubric";
import type { PipelineInput, PipelineProgress, Report } from "./types";

const REPORT_KEY = "nightlight.report.v1";
const META_KEY = "nightlight.input-meta.v1";
const IS_DEV = process.env.NODE_ENV !== "production";

/** Metadata about the last analysis input. File contents are never kept. */
export interface InputMeta {
  fileNames: string[];
  transcriptPlatforms: string[];
  ageBand: AgeBand;
  childName?: string;
}

// ------------------------------------------------------------------ external store (sessionStorage-backed)

interface Snapshot {
  report: Report | null;
  meta: InputMeta | null;
}
const EMPTY: Snapshot = { report: null, meta: null };
let snapshot: Snapshot = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const r = window.sessionStorage.getItem(REPORT_KEY);
    const m = window.sessionStorage.getItem(META_KEY);
    if (r || m) {
      snapshot = {
        report: r ? (JSON.parse(r) as Report) : null,
        meta: m ? (JSON.parse(m) as InputMeta) : null,
      };
    }
  } catch {
    snapshot = EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: Snapshot) {
  loaded = true;
  snapshot = next;
  try {
    if (next.report) window.sessionStorage.setItem(REPORT_KEY, JSON.stringify(next.report));
    else window.sessionStorage.removeItem(REPORT_KEY);
    if (next.meta) window.sessionStorage.setItem(META_KEY, JSON.stringify(next.meta));
    else window.sessionStorage.removeItem(META_KEY);
  } catch {
    // Storage full or blocked: the report simply stays in memory for this page view.
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => {
  ensureLoaded();
  return snapshot;
};
const getServerSnapshot = () => EMPTY;
const noopSubscribe = () => () => {};

// ------------------------------------------------------------------ analysis state

export type AnalysisMode = "demo" | "files";

export type AnalysisState =
  | { status: "idle" }
  | { status: "running"; mode: AnalysisMode; progress: PipelineProgress }
  | { status: "done"; mode: AnalysisMode; progress: PipelineProgress }
  | { status: "error"; mode: AnalysisMode; message: string; detail?: string; capacity?: boolean };

export const INITIAL_PROGRESS: PipelineProgress = {
  stage: "parsing",
  found: { pages: 0, searches: 0, conversations: 0, piiRedacted: 0 },
  history: { done: 0, total: 0 },
  chats: { done: 0, total: 0 },
};

interface ReportStoreValue {
  report: Report | null;
  meta: InputMeta | null;
  /** false during SSR and the first client render, so pages can show a skeleton instead of an empty state */
  hydrated: boolean;
  analysis: AnalysisState;
  setReport: (report: Report | null, meta?: InputMeta | null) => void;
  startAnalysis: (input: PipelineInput) => Promise<void>;
  startDemo: () => Promise<void>;
  /** Instantly loads the cached demo report (used by the error screen and the empty state). */
  loadCachedDemoNow: () => Promise<void>;
  dismissAnalysis: () => void;
  /** Clears the report and goes back to the upload screen. */
  newAnalysis: () => void;
  /** Development only: loads the bundled mock report into the store. */
  loadMock: () => Promise<void>;
}

const Ctx = createContext<ReportStoreValue | null>(null);

export function useReportStore(): ReportStoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReportStore must be used inside <ReportProvider>");
  return v;
}

// ------------------------------------------------------------------ helpers

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isNotImplemented(e: unknown): boolean {
  return e instanceof Error && /not implemented/i.test(e.message);
}

async function importMock(): Promise<Report> {
  const m = await import("./mock-report");
  return m.MOCK_REPORT;
}

/** Short, believable progress animation used only when falling back to the mock report in development. */
async function fakeProgress(report: Report, onProgress: (p: PipelineProgress) => void) {
  const pages = report.stats.uniquePages;
  const searches = report.stats.searchCount;
  const convs = report.conversations.length;
  const pii = report.pii.length;
  const base = INITIAL_PROGRESS;
  const emit = (patch: Partial<PipelineProgress>) => onProgress({ ...base, ...patch });

  emit({ stage: "parsing" });
  for (let i = 1; i <= 5; i++) {
    await sleep(150);
    emit({
      stage: "parsing",
      found: {
        pages: Math.round((pages * i) / 5),
        searches: Math.round((searches * i) / 5),
        conversations: Math.round((convs * i) / 5),
        piiRedacted: 0,
      },
    });
  }
  const found = { pages, searches, conversations: convs, piiRedacted: 0 };
  await sleep(250);
  emit({ stage: "preparing", found });
  await sleep(300);
  emit({ stage: "preparing", found: { ...found, piiRedacted: pii } });
  const hb = 5;
  for (let i = 0; i <= hb; i++) {
    await sleep(380);
    emit({ stage: "history", found: { ...found, piiRedacted: pii }, history: { done: i, total: hb } });
  }
  const cb = 3;
  for (let i = 0; i <= cb; i++) {
    await sleep(420);
    emit({
      stage: "chats",
      found: { ...found, piiRedacted: pii },
      history: { done: hb, total: hb },
      chats: { done: i, total: cb },
    });
  }
  emit({
    stage: "summary",
    found: { ...found, piiRedacted: pii },
    history: { done: hb, total: hb },
    chats: { done: cb, total: cb },
  });
  await sleep(1100);
}

// ------------------------------------------------------------------ provider

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const runId = useRef(0);

  const setReport = useCallback((report: Report | null, meta?: InputMeta | null) => {
    commit({ report, meta: meta === undefined ? (report ? snapshot.meta : null) : meta });
  }, []);

  const finish = useCallback(
    async (mode: AnalysisMode, report: Report, meta: InputMeta | null, id: number, last: PipelineProgress) => {
      if (id !== runId.current) return;
      commit({ report, meta });
      if (report.cachedFallback) {
        toast.info("Live analysis is busy right now", {
          description: "This is the recorded run of the same sample data, so you can still explore the whole report.",
          duration: 9000,
        });
      }
      setAnalysis({
        status: "done",
        mode,
        progress: { ...last, stage: "done" },
      });
      await sleep(650);
      if (id !== runId.current) return;
      router.push("/report");
    },
    [router],
  );

  const run = useCallback(
    async (
      mode: AnalysisMode,
      exec: (onProgress: (p: PipelineProgress) => void) => Promise<Report>,
      meta: InputMeta | null,
      /** development only: should this failure fall back to the mock report? */
      devFallback: (e: unknown) => boolean,
    ) => {
      const id = ++runId.current;
      let latest = INITIAL_PROGRESS;
      const onProgress = (p: PipelineProgress) => {
        if (id !== runId.current) return;
        latest = p;
        setAnalysis({ status: "running", mode, progress: p });
      };
      setAnalysis({ status: "running", mode, progress: INITIAL_PROGRESS });
      try {
        const report = await exec(onProgress);
        await finish(mode, report, meta, id, latest);
      } catch (e) {
        if (id !== runId.current) return;
        let err: unknown = e;
        if (IS_DEV && devFallback(e)) {
          console.warn("[nightlight] pipeline failed; using the mock report (development only).", e);
          try {
            const mock = await importMock();
            await fakeProgress(mock, onProgress);
            await finish(mode, mock, meta, id, latest);
            return;
          } catch (inner) {
            err = inner;
          }
        }
        const detail = err instanceof Error ? err.message : String(err);
        setAnalysis({
          status: "error",
          mode,
          message:
            err instanceof CapacityError
              ? "The live demo is at capacity right now."
              : "We couldn’t finish the analysis this time.",
          detail,
          capacity: err instanceof CapacityError,
        });
      }
    },
    [finish],
  );

  const startAnalysis = useCallback(
    (input: PipelineInput) =>
      run(
        "files",
        (onProgress) => runPipeline(input, onProgress),
        {
          fileNames: input.files.map((f) => f.name),
          transcriptPlatforms: input.transcripts.map((t) => t.platform),
          ageBand: input.ageBand,
          childName: input.childName,
        },
        isNotImplemented,
      ),
    [run],
  );

  const startDemo = useCallback(
    () => run("demo", (onProgress) => runDemo(onProgress), { fileNames: [], transcriptPlatforms: [], ageBand: "13-15" }, () => true),
    [run],
  );

  const loadCachedDemoNow = useCallback(async () => {
    const id = ++runId.current;
    setAnalysis({ status: "running", mode: "demo", progress: { ...INITIAL_PROGRESS, stage: "summary" } });
    try {
      let report: Report;
      try {
        report = await loadCachedDemo();
      } catch (e) {
        if (!IS_DEV) throw e;
        report = await importMock(); // dev: the cached JSON may not exist yet
      }
      await finish("demo", report, { fileNames: [], transcriptPlatforms: [], ageBand: report.ageBand }, id, INITIAL_PROGRESS);
    } catch (e) {
      if (id !== runId.current) return;
      setAnalysis({
        status: "error",
        mode: "demo",
        message: "The demo report isn’t available right now.",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }, [finish]);

  const dismissAnalysis = useCallback(() => {
    runId.current += 1;
    setAnalysis({ status: "idle" });
  }, []);

  const newAnalysis = useCallback(() => {
    runId.current += 1;
    setAnalysis({ status: "idle" });
    commit(EMPTY);
    router.push("/");
  }, [router]);

  const loadMock = useCallback(async () => {
    if (!IS_DEV) return;
    const mock = await importMock();
    commit({ report: mock, meta: { fileNames: [], transcriptPlatforms: [], ageBand: mock.ageBand, childName: mock.childName } });
  }, []);

  const value = useMemo<ReportStoreValue>(
    () => ({
      report: snap.report,
      meta: snap.meta,
      hydrated,
      analysis,
      setReport,
      startAnalysis,
      startDemo,
      loadCachedDemoNow,
      dismissAnalysis,
      newAnalysis,
      loadMock,
    }),
    [snap, hydrated, analysis, setReport, startAnalysis, startDemo, loadCachedDemoNow, dismissAnalysis, newAnalysis, loadMock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

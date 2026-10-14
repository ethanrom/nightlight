"use client";

import { createContext, useContext } from "react";
import type { Report } from "@/lib/types";

export type ReportTab = "overview" | "concerns" | "chats" | "browsing" | "ask";

export interface ReportCtxValue {
  report: Report;
  /** child's name, or "Your child" */
  name: string;
  goTo: (tab: ReportTab, anchor?: string) => void;
}

const Ctx = createContext<ReportCtxValue | null>(null);

export const ReportContextProvider = Ctx.Provider;

export function useReport(): ReportCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReport must be used inside <ReportContextProvider>");
  return v;
}

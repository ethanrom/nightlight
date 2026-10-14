// Dev-only harness for the Ask Nightlight chat: loads the real cached demo report and mounts the chat inside the
// providers the report view normally supplies. Not linked from anywhere; 404s in production.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskHarness } from "./harness";

export const metadata: Metadata = {
  title: "Ask Nightlight (dev)",
  robots: { index: false, follow: false },
};

export default function DevAskPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AskHarness />;
}

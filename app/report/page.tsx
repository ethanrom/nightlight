import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ReportView } from "@/components/report/report-view";

export const metadata: Metadata = {
  title: "Your report",
  robots: { index: false, follow: false },
};

export default function ReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ReportView />
    </Suspense>
  );
}

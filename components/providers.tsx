"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { AnalysingOverlay } from "@/components/analysing/analysing-overlay";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReportProvider } from "@/lib/report-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delay={250}>
          <ReportProvider>
            {children}
            <AnalysingOverlay />
            <Toaster position="bottom-right" />
          </ReportProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

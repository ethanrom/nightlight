"use client";

import { useEffect, useId, useState } from "react";
import { ChartLine, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * True one frame after mount. Charts mount while a hidden tab panel is becoming visible; waiting a beat means the
 * chart measures its container at its real size instead of 0.
 */
export function useChartReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  return ready;
}

/** Card chrome for a chart: title, description, legend, and a table-view twin (every chart has one). */
export function ChartCard({
  title,
  description,
  legend,
  children,
  table,
  className,
  action,
}: {
  title: string;
  description?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
  /** table-view twin of the chart (WCAG-clean equivalent) */
  table?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section className={cn("nl-card min-w-0 p-5 sm:p-6", className)} aria-labelledby={id}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="text-title text-lg">
            {title}
          </h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          {action}
          {table && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
            >
              {asTable ? <ChartLine className="size-3.5" /> : <Table2 className="size-3.5" />}
              {asTable ? "Chart view" : "Table view"}
            </Button>
          )}
        </div>
      </div>
      {legend && !asTable && <div className="mt-4">{legend}</div>}
      <div className="mt-4">{asTable && table ? <div className="max-h-80 overflow-auto rounded-xl border border-border">{table}</div> : children}</div>
    </section>
  );
}

export function LegendItem({
  shape = "dot",
  color,
  children,
}: {
  shape?: "dot" | "diamond" | "bar";
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      {shape === "dot" && <span className="size-2.5 rounded-full" style={{ background: color }} />}
      {shape === "diamond" && <span className="size-2.5 rotate-45 rounded-[2px]" style={{ background: color }} />}
      {shape === "bar" && <span className="h-2.5 w-3 rounded-[3px]" style={{ background: color }} />}
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="px-3 py-2 font-medium">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            {r.map((cell, j) => (
              <td key={j} className={cn("px-3 py-1.5", j > 0 && "tabular-nums")}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

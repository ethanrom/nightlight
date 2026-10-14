"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared chrome for every card in an answer: hairline border, soft shadow, a small icon tile and an eyebrow label. */
export function CardShell({
  icon: Icon,
  label,
  aside,
  children,
  className,
  bodyClassName,
}: {
  icon: LucideIcon;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("nl-card overflow-hidden", className)} aria-label={label}>
      <header className="flex min-h-9 items-center gap-2.5 px-4 pt-3.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="eyebrow">{label}</span>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      <div className={cn("px-4 pt-2.5 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Shimmering placeholder shown while a card's JSON is still streaming in. */
export function CardSkeleton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="nl-card overflow-hidden" aria-hidden>
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="grid size-6 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="eyebrow">{label}</span>
      </div>
      <div className="space-y-2.5 px-4 pt-3.5 pb-4">
        <div className="shimmer h-3.5 w-11/12 rounded-full bg-muted" />
        <div className="shimmer h-3.5 w-9/12 rounded-full bg-muted" />
        <div className="shimmer h-9 w-full rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Globe, HandHeart, Phone } from "lucide-react";
import { CardShell } from "@/components/ask/cards/card-shell";
import type { CardOf } from "@/lib/chat-cards";
import { resourcesFor } from "@/lib/resources";
import { cn } from "@/lib/utils";

const SHOWN = 3;

/** "988" and "0800 1111" can be dialled; "741741 (text HOME)" cannot. */
function dialable(phone: string): string | null {
  return /^[\d\s-]+$/.test(phone) ? phone.replace(/[\s-]/g, "") : null;
}

/** Real organisations from the curated catalogue (lib/resources.ts). The model only picks the topics. */
export function ResourcesCard({ card }: { card: CardOf<"resources"> }) {
  const [all, setAll] = useState(false);
  const list = useMemo(() => resourcesFor(card.dimensions), [card.dimensions]);
  if (list.length === 0) return null;
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <CardShell icon={HandHeart} label="Support that can help">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/60">
        {shown.map((r) => {
          const tel = r.phone ? dialable(r.phone) : null;
          return (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                {r.phone ? <Phone className="size-4" /> : <Globe className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 rounded text-sm font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-[#a8a3ff]"
                  >
                    {r.name}
                    <ExternalLink className="size-3 text-muted-foreground transition-colors group-hover:text-primary" />
                  </a>
                  <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] text-muted-foreground">{r.region}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                {r.phone &&
                  (tel ? (
                    <a
                      href={`tel:${tel}`}
                      className="mt-2 inline-flex h-6 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground tabular-nums outline-none hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Phone className="size-3" />
                      {r.phone}
                    </a>
                  ) : (
                    <span className="mt-2 inline-flex h-6 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground tabular-nums">
                      <Phone className="size-3" />
                      {r.phone}
                    </span>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="mt-2.5 inline-flex items-center gap-1 rounded-full px-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-[#a8a3ff]"
        >
          {all ? "Show fewer" : `Show ${list.length - SHOWN} more`}
          <ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} />
        </button>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        If a child is in immediate danger, contact local emergency services. Nightlight is a conversation aid, not a substitute for professional advice.
      </p>
    </CardShell>
  );
}

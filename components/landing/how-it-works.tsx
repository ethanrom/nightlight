"use client";

import { Cpu, Download, HeartHandshake } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";

const STEPS = [
  {
    icon: Download,
    title: "Export",
    text: "Download your child’s browser history and any AI chat exports, or paste a transcript. Takes about two minutes, ideally together with your child.",
    tag: "You choose the files",
  },
  {
    icon: Cpu,
    title: "Analyse locally + AI",
    text: "Files are parsed in your browser and personal details are masked. Claude then reads the compact, redacted text against a child-development rubric.",
    tag: "Parsed on your device",
  },
  {
    icon: HeartHandshake,
    title: "Talk, not snoop",
    text: "You get calm patterns, not transcripts. Evidence stays blurred until you click, and every concern comes with a warm way to open the conversation.",
    tag: "Kind by design",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14" aria-labelledby="how-title">
      <div className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="text-display mt-3 text-3xl text-balance sm:text-[2.6rem]">
          Three calm steps.
        </h2>
      </div>
      <Stagger className="relative mt-10 grid grid-cols-1 gap-5 md:grid-cols-3" gap={0.1}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title}>
            <div className="nl-card nl-card-hover relative h-full p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">0{i + 1}</span>
              </div>
              <h3 className="text-title mt-5 text-xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
              <p className="mt-4 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/75">
                {s.tag}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, motion, useReducedMotion, type Variants } from "motion/react";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

interface FadeUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** animate when scrolled into view instead of on mount */
  inView?: boolean;
}

/** Fade-up. Animates on mount by default so printed pages never stay hidden. */
export function FadeUp({ children, className, delay = 0, y = 14, inView = false }: FadeUpProps) {
  const target = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      {...(inView
        ? { whileInView: target, viewport: { once: true, margin: "-60px" } }
        : { animate: target })}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  inView = false,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  inView?: boolean;
}) {
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-60px" } } : { animate: "show" })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 14,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up from the last displayed value. Pass a module-level `format` function. */
export function CountUp({
  value,
  duration = 1.1,
  format = fmtNum,
  className,
  tabular = true,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  /** big standalone numbers look better with proportional figures */
  tabular?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const fmt = useRef(format);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    fmt.current = format;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = fmt.current(value);
      shown.current = value;
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt.current(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={cn(tabular && "tabular-nums", className)}>
      {format(value)}
    </span>
  );
}

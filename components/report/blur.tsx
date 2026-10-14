"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Content that stays blurred (and hidden from assistive tech) until the parent chooses to reveal it. */
export function Blurred({
  revealed,
  children,
  className,
  as: Tag = "span",
}: {
  revealed: boolean;
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
}) {
  return (
    <Tag
      aria-hidden={!revealed}
      className={cn(revealed ? "nl-blur-off" : "nl-blur", className)}
    >
      {children}
    </Tag>
  );
}

export function RevealButton({
  revealed,
  onToggle,
  className,
  size = "sm",
}: {
  revealed: boolean;
  onToggle: () => void;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button
      type="button"
      variant={revealed ? "ghost" : "outline"}
      size={size}
      onClick={onToggle}
      className={cn("rounded-full", className)}
      aria-pressed={revealed}
    >
      {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {revealed ? "Hide" : "Reveal"}
    </Button>
  );
}

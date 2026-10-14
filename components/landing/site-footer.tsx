import Link from "next/link";
import { Heart } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border/70 print:hidden">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} glow={false} />
            <Wordmark />
          </div>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            <Heart className="mr-1.5 inline size-3.5 -translate-y-px text-sev-urgent" />
            Nightlight is a conversation aid, not a diagnosis. We encourage telling your child you use it. Findings can
            be wrong, and every concern is a prompt to talk, never a verdict.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-6 text-sm md:justify-self-end" aria-label="Footer">
          <div className="space-y-2.5">
            <p className="eyebrow">Product</p>
            <Link href="/#upload" className="block text-muted-foreground transition-colors hover:text-foreground">
              Analyse files
            </Link>
            <Link href="/methodology" className="block text-muted-foreground transition-colors hover:text-foreground">
              Methodology
            </Link>
          </div>
          <div className="space-y-2.5">
            <p className="eyebrow">Principles</p>
            <p className="text-muted-foreground">Understand, don’t surveil</p>
            <p className="text-muted-foreground">Parsed in your browser</p>
            <p className="text-muted-foreground">Nothing stored</p>
          </div>
        </nav>
      </div>
    </footer>
  );
}

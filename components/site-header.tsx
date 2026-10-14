import Link from "next/link";
import { BookOpen } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn("glass sticky top-0 z-40 border-b border-border/70 print:hidden", className)}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-offset-4" aria-label="Nightlight home">
          <LogoMark size={30} />
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link
            href="/methodology"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="size-4" />
            Methodology
          </Link>
          <ThemeToggle className="size-9" />
        </nav>
      </div>
    </header>
  );
}

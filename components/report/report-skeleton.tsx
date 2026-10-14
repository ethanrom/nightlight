import { LogoMark } from "@/components/brand/logo";

export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your report">
      <div className="glass border-b border-border/70">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-5 sm:px-8">
          <LogoMark size={30} />
          <div className="space-y-2">
            <div className="shimmer h-3.5 w-36 rounded-full bg-muted" />
            <div className="shimmer h-3 w-52 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] space-y-6 px-5 py-8 sm:px-8">
        <div className="shimmer h-56 rounded-[var(--radius-2xl)] bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="shimmer h-36 rounded-[var(--radius-2xl)] bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

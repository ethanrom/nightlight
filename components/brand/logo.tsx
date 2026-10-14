import { cn } from "@/lib/utils";

/** Nightlight mark: a small crescent lamp in an indigo tile, with a soft amber glow. */
export function LogoMark({
  size = 32,
  glow = true,
  className,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          aria-hidden
          className="absolute -inset-2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.55),transparent_68%)] blur-md"
        />
      )}
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="relative drop-shadow-sm"
        role="img"
        aria-label="Nightlight"
      >
        <defs>
          <linearGradient id="nl-tile" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7a72f2" />
            <stop offset="1" stopColor="#4338c9" />
          </linearGradient>
          <linearGradient id="nl-moon" x1="10" y1="7" x2="23" y2="25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffe3a8" />
            <stop offset="1" stopColor="#f6b24a" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9.5" fill="url(#nl-tile)" />
        <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="rgb(255 255 255 / 0.22)" />
        <path
          d="M21.6 21.2A8.4 8.4 0 0 1 12.2 8.7a.4.4 0 0 0-.56-.46A9.7 9.7 0 1 0 22 22.1a.4.4 0 0 0-.4-.9Z"
          fill="url(#nl-moon)"
        />
        <path d="M23.2 7.4l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8Z" fill="#fff" fillOpacity="0.92" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[1.05rem] font-semibold tracking-[-0.02em] text-foreground", className)}>
      Nightlight
    </span>
  );
}

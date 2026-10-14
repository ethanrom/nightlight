// Mirrors SectionHeading in app/methodology/page.tsx so the two pages read as siblings.
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-28">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-display mt-3 text-3xl text-balance sm:text-4xl">
        {title}
      </h2>
      {children && (
        <div className="mt-4 max-w-2xl text-[1.02rem] leading-relaxed text-pretty text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

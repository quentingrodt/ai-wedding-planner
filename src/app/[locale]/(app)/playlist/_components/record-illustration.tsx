import { cn } from "@/lib/utils";

/** Disque vinyle stylisé, aux couleurs de la maison (aucune marque tierce). */
export function RecordIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" aria-hidden className={cn("h-auto", className)}>
      <circle cx="80" cy="80" r="76" className="fill-charcoal" />
      {[64, 54, 44].map((r) => (
        <circle
          key={r}
          cx="80"
          cy="80"
          r={r}
          fill="none"
          strokeWidth="0.8"
          className="stroke-stone/60"
        />
      ))}
      <circle cx="80" cy="80" r="28" className="fill-terracotta" />
      <circle
        cx="80"
        cy="80"
        r="20"
        fill="none"
        strokeWidth="1"
        className="stroke-terracotta-soft/70"
      />
      <circle cx="80" cy="80" r="3.5" className="fill-linen" />
      <path
        d="M30 46 A58 58 0 0 1 66 24"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-ivory/25"
      />
    </svg>
  );
}

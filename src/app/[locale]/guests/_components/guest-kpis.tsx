import { useTranslations } from "next-intl";
import type { GuestSummary } from "@/lib/guests/schema";
import { cn } from "@/lib/utils";

const CARDS = [
  { key: "total", surface: "bg-linen", figure: "text-charcoal" },
  { key: "confirmed", surface: "bg-sage-soft", figure: "text-sage-deep" },
  { key: "pending", surface: "bg-terracotta-soft/70", figure: "text-terracotta" },
  { key: "children", surface: "bg-sand/50", figure: "text-charcoal" },
] as const satisfies readonly { key: keyof GuestSummary; surface: string; figure: string }[];

/** Indicateurs clés de la liste d'invités. */
export function GuestKpis({ summary }: { summary: GuestSummary }) {
  const t = useTranslations("Guests.kpis");
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map(({ key, surface, figure }) => (
        <div
          key={key}
          className={cn("flex flex-col-reverse gap-1 rounded-3xl px-5 py-4", surface)}
        >
          <dt className="text-sm text-stone">{t(key)}</dt>
          <dd className={cn("font-serif text-4xl tabular-nums", figure)}>
            {summary[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

import { useTranslations } from "next-intl";
import type { FamilySummary } from "@/lib/guests/schema";

type FamilyCompositionProps = {
  summary: FamilySummary;
  className?: string;
};

/** « 6 adultes · 1 enfant » : la composition d'une famille en une ligne. */
export function FamilyComposition({ summary, className }: FamilyCompositionProps) {
  const t = useTranslations("Guests.families.composition");
  const parts: string[] = [];
  if (summary.adults > 0 || summary.children === 0) {
    parts.push(t("adults", { count: summary.adults }));
  }
  if (summary.children > 0) parts.push(t("children", { count: summary.children }));
  return <span className={className}>{parts.join(" · ")}</span>;
}

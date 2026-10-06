"use client";

import { ChevronDownIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { summarizeFamily, type Guest } from "@/lib/guests/schema";
import { cn } from "@/lib/utils";
import { FamilyComposition } from "./family-composition";

const ANSWER_SEGMENTS = [
  { key: "confirmed", color: "bg-sage" },
  { key: "pending", color: "bg-sand" },
  { key: "declined", color: "bg-terracotta/70" },
] as const;

type HouseholdSectionProps = {
  id: string;
  title: string;
  /** Tous les membres du foyer (le résumé ignore les filtres). */
  members: Guest[];
  expanded: boolean;
  onToggle: () => void;
  /** Ouvre la fiche de la famille ; absent pour « Autres invités ». */
  onManage?: () => void;
  children: ReactNode;
};

/** Un foyer repliable : son nom, où il en est, puis ses invités. */
export function HouseholdSection({
  id,
  title,
  members,
  expanded,
  onToggle,
  onManage,
  children,
}: HouseholdSectionProps) {
  const t = useTranslations("Guests");
  const summary = summarizeFamily(members);
  const total = members.length;
  const panelId = `household-${id}`;

  return (
    <section className="rounded-3xl bg-card ring-1 ring-border">
      <div className="flex items-center gap-2 py-2 pr-3 pl-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={total > 0 ? panelId : undefined}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-linen/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-stone transition-transform",
              !expanded && "-rotate-90",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="font-serif text-xl leading-tight wrap-break-word">{title}</span>
            <span className="text-sm text-stone">
              {total === 0 ? (
                t("list.emptyHousehold")
              ) : (
                <>
                  <FamilyComposition summary={summary} />
                  {" · "}
                  {t("families.answers.confirmedOf", { confirmed: summary.confirmed, total })}
                </>
              )}
            </span>
          </span>
          {total > 0 && (
            <span
              aria-hidden
              className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-linen sm:flex"
            >
              {ANSWER_SEGMENTS.map(({ key, color }) =>
                summary[key] > 0 ? (
                  <span
                    key={key}
                    className={color}
                    style={{ width: `${(summary[key] / total) * 100}%` }}
                  />
                ) : null,
              )}
            </span>
          )}
        </button>
        {onManage && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("list.manage", { name: title })}
            onClick={onManage}
            className="shrink-0 rounded-full text-stone"
          >
            <Settings2Icon aria-hidden />
          </Button>
        )}
      </div>
      {total > 0 && (
        <ul
          id={panelId}
          hidden={!expanded}
          className="mx-5 flex flex-col divide-y divide-border border-t border-border"
        >
          {children}
        </ul>
      )}
    </section>
  );
}

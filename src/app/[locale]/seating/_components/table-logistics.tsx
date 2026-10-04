"use client";

import { BabyIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SeatedGuest } from "@/lib/seating/schema";

type TableLogisticsProps = {
  guests: SeatedGuest[];
  fullName: (guest: SeatedGuest) => string;
};

/**
 * Contraintes logistiques d'une table : nombre d'enfants et régimes
 * alimentaires (détaillés en infobulle, pour le traiteur). Rien si la table
 * n'a ni enfant ni régime particulier.
 */
export function TableLogistics({ guests, fullName }: TableLogisticsProps) {
  const t = useTranslations("Seating.tables.logistics");
  // Infobulle contrôlée : elle s'ouvre aussi au toucher (mobile), pas seulement au survol.
  const [open, setOpen] = useState(false);

  const children = guests.filter((guest) => guest.is_child).length;
  const diets = guests.flatMap((guest) =>
    guest.dietary_requirements ? [{ id: guest.id, name: fullName(guest), diet: guest.dietary_requirements }] : [],
  );
  if (children === 0 && diets.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {children > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sand/50 px-2.5 py-1 text-xs text-charcoal">
          <BabyIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
          {t("children", { count: children })}
        </span>
      )}
      {diets.length > 0 && (
        <TooltipProvider delayDuration={150}>
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-soft/50 px-2.5 py-1 text-xs text-terracotta transition-colors hover:bg-terracotta-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <CircleAlertIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
                {t("dietary", { count: diets.length })}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="max-w-64 flex-col items-start gap-1.5 px-3.5 py-2.5">
              <p className="text-[0.7rem] tracking-[0.15em] uppercase opacity-70">{t("dietaryTitle")}</p>
              <ul className="flex flex-col gap-1 text-xs leading-5">
                {diets.map(({ id, name, diet }) => (
                  <li key={id}>{t("dietaryEntry", { name, diet })}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

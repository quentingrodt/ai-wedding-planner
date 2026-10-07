"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PlanCategory, PlanOf } from "@/lib/vendors/plans";
import type { VendorActionResult } from "@/lib/vendors/schema";
import { saveVendorPlan } from "../../actions";

/** Carnet modifiable : l'état local, s'il a changé, et son enregistrement. */
export function usePlan<C extends PlanCategory>(category: C, initial: PlanOf<C>) {
  const t = useTranslations("Vendors");
  const [plan, setPlan] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);

  function save() {
    startTransition(async () => {
      const result = await saveVendorPlan(category, plan).catch(
        (): VendorActionResult => ({ ok: false, error: "generic" }),
      );
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      setSaved(plan);
      toast(t("tools.saved"));
    });
  }

  return { plan, setPlan, dirty, pending, save };
}

/** Bloc d'un outil : titre, chapeau, contenu, et le bouton d'enregistrement s'il y a des changements. */
export function PlanCard({
  title,
  lead,
  children,
  dirty,
  pending,
  onSave,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  dirty?: boolean;
  pending?: boolean;
  onSave?: () => void;
}) {
  const t = useTranslations("Vendors.tools");
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-2xl">{title}</h3>
          {lead && <p className="max-w-2xl text-sm text-pretty text-stone">{lead}</p>}
        </div>
        {onSave && dirty && (
          <Button size="sm" className="rounded-full px-4" disabled={pending} onClick={onSave}>
            {pending ? t("saving") : t("save")}
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export const textareaClass =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Pastille à cocher (stands, idées de cadeaux, boissons servies). */
export function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        "rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none " +
        (pressed ? "bg-sage-soft text-sage-deep ring-sage" : "bg-card text-charcoal ring-border hover:bg-linen")
      }
    >
      {children}
    </button>
  );
}

export const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

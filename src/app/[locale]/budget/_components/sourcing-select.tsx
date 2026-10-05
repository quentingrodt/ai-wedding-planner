"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUDGET_SOURCINGS, type BudgetSourcing } from "@/lib/budget/schema";
import { cn } from "@/lib/utils";

const DOT: Record<BudgetSourcing, string> = {
  network: "bg-sage",
  celeste: "bg-lavender",
  undecided: "border border-stone/40 bg-ivory",
};

const SURFACE: Record<BudgetSourcing, string> = {
  network: "bg-sage-soft text-sage-deep",
  celeste: "bg-lavender-soft text-charcoal",
  undecided: "bg-ivory text-stone",
};

/** Pastille de couleur du sourcing : sauge (réseau), lavande (Céleste), blanc (à définir). */
export function SourcingDot({ sourcing }: { sourcing: BudgetSourcing }) {
  return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", DOT[sourcing])} />;
}

/** Sélecteur compact du sourcing d'un prestataire, directement sur sa ligne. */
export function SourcingSelect({
  value,
  itemName,
  disabled,
  onChange,
}: {
  value: BudgetSourcing;
  itemName: string;
  disabled?: boolean;
  onChange: (value: BudgetSourcing) => void;
}) {
  const t = useTranslations("Budget.sourcing");
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as BudgetSourcing)}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("change", { name: itemName, current: t(value) })}
        className={cn("rounded-full border-transparent px-3 text-xs", SURFACE[value])}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BUDGET_SOURCINGS.map((option) => (
          <SelectItem key={option} value={option}>
            <SourcingDot sourcing={option} />
            {t(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

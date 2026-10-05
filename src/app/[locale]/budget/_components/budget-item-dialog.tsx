"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUDGET_CATEGORIES,
  BUDGET_LIMITS,
  BUDGET_SOURCINGS,
  parseBudgetItem,
  type BudgetCategory,
  type BudgetItem,
  type BudgetItemField,
  type BudgetItemFieldErrors,
  type BudgetItemInput,
  type BudgetSourcing,
} from "@/lib/budget/schema";
import { SourcingDot } from "./sourcing-select";

type BudgetItemDialogProps = {
  /** Ligne à modifier ; absente, la modale crée un nouveau prestataire. */
  item?: BudgetItem;
  /** Devise du mariage, affichée à côté des montants. */
  currency: string;
  trigger: ReactNode;
  /** Appelée avec une saisie déjà validée : la modale se ferme aussitôt. */
  onSubmit: (input: BudgetItemInput) => void;
};

/** Formulaire d'ajout ou de modification d'un prestataire, en modale. */
export function BudgetItemDialog({ item, currency, trigger, onSubmit }: BudgetItemDialogProps) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const mode = item ? "edit" : "add";
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<BudgetItemFieldErrors>({});
  const [category, setCategory] = useState<BudgetCategory | "">(item?.category ?? "");
  const [sourcing, setSourcing] = useState<BudgetSourcing>(item?.sourcing ?? "undecided");

  // Le contenu de la modale est démonté à la fermeture : la saisie repart à zéro.
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setFieldErrors({});
      setCategory(item?.category ?? "");
      setSourcing(item?.sourcing ?? "undecided");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: BudgetItemInput = {
      category: category as BudgetCategory,
      label: String(data.get("label") ?? ""),
      estimatedAmount: String(data.get("estimatedAmount") ?? ""),
      actualAmount: String(data.get("actualAmount") ?? ""),
      sourcing,
    };

    // Même schéma que le serveur : on ne ferme qu'une saisie valide,
    // ce qui permet d'afficher la ligne avant la réponse du serveur.
    const parsed = parseBudgetItem(input);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }
    onSubmit(input);
    changeOpen(false);
  }

  const describedBy = (field: BudgetItemField, hint?: string) =>
    [fieldErrors[field] ? `budget-${field}-error` : null, hint].filter(Boolean).join(" ") ||
    undefined;

  const fieldProps = (field: BudgetItemField) => ({
    id: `budget-${field}`,
    name: field,
    "aria-invalid": fieldErrors[field] ? true : undefined,
    "aria-describedby": describedBy(field),
  });

  const fieldError = (field: BudgetItemField) => {
    const error = fieldErrors[field];
    return error ? (
      <p id={`budget-${field}-error`} className="text-sm text-destructive">
        {t(`fieldErrors.${error}`)}
      </p>
    ) : null;
  };

  const optional = <span className="font-normal text-stone">{t("form.optional")}</span>;

  const amountInput = (field: "estimatedAmount" | "actualAmount", value: number | null) => (
    <div className="relative">
      <Input
        {...fieldProps(field)}
        aria-describedby={describedBy(
          field,
          field === "actualAmount" ? "budget-actual-hint" : undefined,
        )}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={value === null ? "" : String(value)}
        placeholder="0"
        className="h-11 pr-14 text-base tabular-nums"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-stone"
      >
        {currency}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("form.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-category">{t("form.category")}</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as BudgetCategory)}
            >
              <SelectTrigger
                id="budget-category"
                aria-invalid={fieldErrors.category ? true : undefined}
                aria-describedby={describedBy("category")}
                className="h-11 w-full data-[size=default]:h-11"
              >
                <SelectValue placeholder={t("form.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`categories.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("category")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-label">
              {t("form.label")} {optional}
            </Label>
            <Input
              {...fieldProps("label")}
              type="text"
              autoComplete="off"
              placeholder={t("form.labelPlaceholder")}
              defaultValue={item?.label ?? ""}
              maxLength={BUDGET_LIMITS.label}
              className="h-11 text-base"
            />
            {fieldError("label")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-sourcing">{t("sourcing.label")}</Label>
            <Select
              value={sourcing}
              onValueChange={(value) => setSourcing(value as BudgetSourcing)}
            >
              <SelectTrigger id="budget-sourcing" className="h-11 w-full data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_SOURCINGS.map((value) => (
                  <SelectItem key={value} value={value}>
                    <SourcingDot sourcing={value} />
                    {t(`sourcing.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget-estimatedAmount">{t("form.estimated")}</Label>
              {amountInput("estimatedAmount", item?.estimated_amount ?? null)}
              {fieldError("estimatedAmount")}
              {item?.suggested_amount != null && (
                <p className="text-sm text-stone/70 tabular-nums">
                  {t("vendors.indication")} ≈{" "}
                  {format.number(item.suggested_amount, {
                    style: "currency",
                    currency,
                    maximumFractionDigits: 0,
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="budget-actualAmount">
                {t("form.actual")} {optional}
              </Label>
              {amountInput("actualAmount", item?.actual_amount ?? null)}
              {fieldError("actualAmount")}
            </div>
          </div>
          <p id="budget-actual-hint" className="-mt-2 text-sm text-muted-foreground">
            {t("form.actualHint")}
          </p>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("form.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" className="h-11 rounded-full px-6">
              {t(`${mode}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

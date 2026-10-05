"use client";

import { Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUDGET_LIMITS,
  budgetLineSchema,
  NOTES_MAX,
  type BudgetItem,
  type BudgetLineInput,
  type BudgetSourcing,
} from "@/lib/budget/schema";
import {
  BUDGET_PAYERS,
  type BudgetLineKey,
  type BudgetPayer,
  type BudgetSection,
} from "@/lib/budget/worksheet";
import { cn } from "@/lib/utils";
import { deleteBudgetLine, saveBudgetLine } from "../actions";
import { SourcingSelect } from "./sourcing-select";

type Draft = {
  label: string;
  estimated: string;
  actual: string;
  notes: string;
  payer: BudgetPayer | null;
  sourcing: BudgetSourcing;
};

const draftOf = (item: BudgetItem | null, display: (value: number) => string = String): Draft => ({
  label: item?.label ?? "",
  estimated: item && item.estimated_amount > 0 ? display(item.estimated_amount) : "",
  actual: item?.actual_amount === null || item === null ? "" : display(item.actual_amount),
  notes: item?.notes ?? "",
  payer: item?.payer ?? null,
  sourcing: item?.sourcing ?? "undecided",
});

const sameDraft = (a: Draft, b: Draft) =>
  a.label.trim() === b.label.trim() &&
  a.estimated.replace(/\D/g, "") === b.estimated.replace(/\D/g, "") &&
  a.actual.replace(/\D/g, "") === b.actual.replace(/\D/g, "") &&
  a.notes.trim() === b.notes.trim() &&
  a.payer === b.payer &&
  a.sourcing === b.sourcing;

/** Champ discret de la grille : se révèle au survol et à la saisie. */
const fieldClass =
  "h-9 w-full rounded-lg bg-transparent px-2.5 text-sm ring-1 ring-transparent transition-colors outline-none placeholder:text-stone/50 hover:bg-ivory hover:ring-sand focus:bg-ivory focus:ring-sage aria-invalid:ring-terracotta";

/**
 * Une ligne de la grille : poste de la grille (lineKey) ou poste ajouté par le
 * couple. Chaque champ s'enregistre en quittant la saisie ; les envois d'une
 * même ligne sont faits l'un après l'autre.
 */
export function BudgetLineRow({
  item,
  section,
  lineKey,
  name,
  tradition,
  currency,
  autoFocus = false,
  onSaved,
  onRemoved,
}: {
  item: BudgetItem | null;
  section: BudgetSection;
  lineKey: BudgetLineKey | null;
  /** Nom du poste de la grille ; absent pour un poste ajouté (libellé saisi). */
  name: string | null;
  tradition: BudgetPayer;
  currency: string;
  autoFocus?: boolean;
  onSaved: (item: BudgetItem | null) => void;
  onRemoved?: () => void;
}) {
  const t = useTranslations("Budget");
  const format = useFormatter();
  const [draft, setDraft] = useState(() => draftOf(item, (value) => format.number(value)));
  const [invalid, setInvalid] = useState<"estimated" | "actual" | "label" | null>(null);
  const [pending, startTransition] = useTransition();
  const saved = useRef(draftOf(item));
  // Mobile : « Qui paie » et notes repliés pour les postes encore vides.
  const [expanded, setExpanded] = useState(false);
  // L'identifiant arrive après la première création : état pour l'affichage, ref pour la file d'envoi.
  const [savedId, setSavedId] = useState(item?.id ?? null);
  const itemId = useRef(item?.id ?? null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  const amountOf = (value: string) => {
    const digits = value.replace(/[\s  ]/g, "");
    return /^\d+$/.test(digits) ? Number(digits) : null;
  };

  const estimated = amountOf(draft.estimated) ?? 0;
  const actual = amountOf(draft.actual);
  const over = actual !== null && estimated > 0 && actual > estimated;
  const filled = estimated > 0 || actual !== null || draft.notes.trim() !== "";
  const effectivePayer = draft.payer ?? tradition;
  const showDetails = expanded || filled || draft.payer !== null;
  const label = name ?? (draft.label.trim() || t("worksheet.newLine"));

  function save(next: Draft) {
    const input: BudgetLineInput = {
      id: itemId.current,
      lineKey,
      section,
      label: next.label,
      estimatedAmount: next.estimated,
      actualAmount: next.actual,
      notes: next.notes,
      payer: next.payer,
      sourcing: next.sourcing,
    };
    const parsed = budgetLineSchema.safeParse(input);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      setInvalid(
        field === "estimatedAmount" ? "estimated" : field === "actualAmount" ? "actual" : "label",
      );
      return;
    }
    setInvalid(null);
    if (sameDraft(next, saved.current)) return;
    // Un poste ajouté sans libellé n'est pas encore enregistrable.
    if (!lineKey && next.label.trim() === "") return;
    saved.current = next;

    startTransition(async () => {
      queue.current = queue.current.then(async () => {
        const result = await saveBudgetLine({ ...input, id: itemId.current });
        if (!result.ok) {
          saved.current = draftOf(null);
          toast.error(t(`errors.${result.error}`));
          return;
        }
        itemId.current = result.item?.id ?? null;
        setSavedId(itemId.current);
        onSaved(result.item);
      });
      await queue.current;
    });
  }

  function update(patch: Partial<Draft>, immediate = false) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (immediate) save(next);
  }

  function formatAmount(field: "estimated" | "actual") {
    const value = amountOf(draft[field]);
    if (value !== null) setDraft((current) => ({ ...current, [field]: format.number(value) }));
  }

  function remove() {
    const id = itemId.current;
    if (!id) {
      onRemoved?.();
      return;
    }
    startTransition(async () => {
      const result = await deleteBudgetLine(id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      onSaved(null);
      onRemoved?.();
    });
  }

  const amountField = (field: "estimated" | "actual") => (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft[field]}
      onChange={(event) => update({ [field]: event.target.value })}
      onFocus={() =>
        setDraft((current) => ({ ...current, [field]: current[field].replace(/[\s  ]/g, "") }))
      }
      onBlur={() => {
        save(draft);
        formatAmount(field);
      }}
      maxLength={12}
      aria-invalid={invalid === field ? true : undefined}
      aria-label={t(`worksheet.${field}Label`, { name: label })}
      placeholder={
        field === "estimated" && item?.suggested_amount
          ? `≈ ${format.number(item.suggested_amount)}`
          : "—"
      }
      title={
        field === "estimated" && item?.suggested_amount && estimated === 0
          ? t("vendors.indicationHint")
          : undefined
      }
      className={cn(
        fieldClass,
        "text-right tabular-nums",
        field === "actual" && over && "text-terracotta",
        field === "actual" && actual !== null && !over && "text-sage-deep",
      )}
    />
  );

  return (
    <li
      className={cn(
        "grid grid-cols-2 items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_7rem_7rem_10.5rem_minmax(0,1.3fr)_2rem] sm:gap-y-0",
        pending && "opacity-70",
      )}
    >
      <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
        {name ? (
          <span className={cn("text-sm wrap-break-word", filled ? "text-charcoal" : "text-stone")}>
            {name}
          </span>
        ) : (
          <input
            type="text"
            value={draft.label}
            onChange={(event) => update({ label: event.target.value })}
            onBlur={() => save(draft)}
            maxLength={BUDGET_LIMITS.label}
            // Nouvelle ligne ajoutée par le couple : on saisit directement son nom.
            autoFocus={autoFocus}
            aria-invalid={invalid === "label" ? true : undefined}
            aria-label={t("worksheet.lineName")}
            placeholder={t("worksheet.lineNamePlaceholder")}
            className={cn(fieldClass, "-ml-2.5 w-[calc(100%+0.625rem)]")}
          />
        )}
        {filled && savedId && (
          <SourcingSelect
            value={draft.sourcing}
            itemName={label}
            onChange={(sourcing) => update({ sourcing }, true)}
          />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-stone sm:hidden">{t("worksheet.columns.estimated")}</span>
        {amountField("estimated")}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-stone sm:hidden">{t("worksheet.columns.actual")}</span>
        {amountField("actual")}
      </div>

      {!showDetails && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="col-span-2 w-fit text-xs text-sage-deep underline decoration-sand underline-offset-4 sm:hidden"
        >
          {t("worksheet.details")}
        </button>
      )}

      <div
        className={cn(
          "col-span-2 flex-col gap-0.5 sm:col-span-1 sm:flex",
          showDetails ? "flex" : "hidden",
        )}
      >
        <span className="text-xs text-stone sm:hidden">{t("worksheet.columns.payer")}</span>
        <Select
          value={effectivePayer}
          onValueChange={(value) =>
            update({ payer: value === tradition ? null : (value as BudgetPayer) }, true)
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={t("worksheet.payerLabel", { name: label })}
            className={cn(
              "h-9 w-full border-transparent bg-transparent text-xs hover:bg-ivory data-[size=sm]:h-9",
              draft.payer ? "text-charcoal" : "text-stone",
            )}
          >
            <SelectValue>{t(`payers.${effectivePayer}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BUDGET_PAYERS.map((payer) => (
              <SelectItem key={payer} value={payer}>
                {t(`payers.${payer}`)}
                {payer === tradition && (
                  <span className="text-xs text-stone">{t("worksheet.tradition")}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "col-span-2 flex-col gap-0.5 sm:col-span-1 sm:flex",
          showDetails ? "flex" : "hidden",
        )}
      >
        <span className="text-xs text-stone sm:hidden">{t("worksheet.columns.notes")}</span>
        <input
          type="text"
          value={draft.notes}
          onChange={(event) => update({ notes: event.target.value })}
          onBlur={() => save(draft)}
          maxLength={NOTES_MAX}
          aria-label={t("worksheet.notesLabel", { name: label })}
          placeholder={t("worksheet.notesPlaceholder")}
          className={fieldClass}
        />
      </div>

      <div
        className={cn(
          "col-span-2 justify-end sm:col-span-1 sm:flex",
          !lineKey || filled ? "flex" : "hidden",
        )}
      >
        {(!lineKey || filled) && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (lineKey) {
                const cleared = { ...draftOf(null) };
                setDraft(cleared);
                save(cleared);
              } else {
                remove();
              }
            }}
            aria-label={
              lineKey
                ? t("worksheet.clear", { name: label })
                : t("worksheet.remove", { name: label })
            }
            title={lineKey ? t("worksheet.clearHint") : undefined}
            className="text-stone hover:text-terracotta"
          >
            <Trash2Icon aria-hidden />
          </Button>
        )}
      </div>

      {over && (
        <p className="col-span-2 text-xs text-terracotta sm:col-span-6">
          {t("worksheet.over", { amount: money(actual - estimated) })}
        </p>
      )}
    </li>
  );
}

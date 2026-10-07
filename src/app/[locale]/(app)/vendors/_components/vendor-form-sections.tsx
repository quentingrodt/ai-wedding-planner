"use client";

import { ChevronDownIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VendorCategory } from "@/lib/vendors/catalog";
import { DETAIL_FIELDS, QUESTION_COUNTS, type DetailField } from "@/lib/vendors/details";
import { VENDOR_LIMITS } from "@/lib/vendors/schema";
import { cn } from "@/lib/utils";

const fieldClass = "h-11 rounded-xl bg-card text-base";
const selectClass = "h-11 w-full rounded-xl bg-card data-[size=default]:h-11";
const textareaClass =
  "w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const amountDigits = String(VENDOR_LIMITS.price).length;
// Valeur des listes déroulantes pour « non renseigné » (Radix refuse une valeur vide).
const UNSET = "unset";

export const onlyDigits = (value: string, length = amountDigits) => value.replace(/\D/g, "").slice(0, length);

// — Paiements —

export type PaymentState = {
  deposit: string;
  depositDue: string;
  depositPaid: boolean;
  secondPayment: string;
  secondDue: string;
  secondPaid: boolean;
  balanceDue: string;
  balancePaid: boolean;
};

/** Acompte et deuxième versement saisis ; le solde se déduit du prix convenu. */
export function PaymentFields({
  state,
  onChange,
  balance,
  currencySymbol,
}: {
  state: PaymentState;
  onChange: (patch: Partial<PaymentState>) => void;
  /** Solde calculé, ou null tant que le prix (ou le nombre d'invités) manque. */
  balance: number | null;
  currencySymbol: string;
}) {
  const t = useTranslations("Vendors.payments");
  const format = useFormatter();

  const row = (
    kind: "deposit" | "second",
    amountKey: "deposit" | "secondPayment",
    dueKey: "depositDue" | "secondDue",
    paidKey: "depositPaid" | "secondPaid",
  ) => (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`vendor-${kind}`}>{t(kind)}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`vendor-${kind}`}
            inputMode="numeric"
            value={state[amountKey]}
            onChange={(event) => onChange({ [amountKey]: onlyDigits(event.target.value) })}
            className={`${fieldClass} w-28`}
          />
          <span className="text-stone">{currencySymbol}</span>
        </div>
      </div>
      <DueField id={`vendor-${kind}-due`} value={state[dueKey]} onChange={(value) => onChange({ [dueKey]: value })} />
      <PaidBox checked={state[paidKey]} onChange={(value) => onChange({ [paidKey]: value })} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {row("deposit", "deposit", "depositDue", "depositPaid")}
      {row("second", "secondPayment", "secondDue", "secondPaid")}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex min-w-40 flex-1 flex-col gap-2">
          <span className="text-sm font-medium">{t("balance")}</span>
          <p className="flex min-h-11 items-center text-sm text-stone">
            {balance !== null
              ? t("balanceComputed", {
                  amount: format.number(balance, { maximumFractionDigits: 0 }) + " " + currencySymbol,
                })
              : t("balanceUnknown")}
          </p>
        </div>
        <DueField id="vendor-balance-due" value={state.balanceDue} onChange={(value) => onChange({ balanceDue: value })} />
        <PaidBox checked={state.balancePaid} onChange={(value) => onChange({ balancePaid: value })} />
      </div>
    </div>
  );
}

function DueField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Vendors.payments");
  return (
    <div className="flex w-40 flex-col gap-2">
      <Label htmlFor={id} className="text-xs font-normal text-stone">{t("due")}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} />
    </div>
  );
}

function PaidBox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const t = useTranslations("Vendors.payments");
  return (
    <label className="flex h-11 items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-sage-deep"
      />
      {t("paid")}
    </label>
  );
}

// — Détails de la catégorie —

export type DetailState = Record<string, string>;

/** Valeurs de la fiche, en texte, à partir des détails enregistrés. */
export function detailState(category: VendorCategory, details: Record<string, unknown>): DetailState {
  return Object.fromEntries(
    DETAIL_FIELDS[category].map((field) => [field.key, details[field.key] == null ? "" : String(details[field.key])]),
  );
}

/** Détails prêts à enregistrer : nombres convertis, champs vides retirés. */
export function detailValues(category: VendorCategory, state: DetailState) {
  const values: Record<string, string | number> = {};
  for (const field of DETAIL_FIELDS[category]) {
    const raw = state[field.key]?.trim() ?? "";
    if (raw === "" || raw === UNSET) continue;
    if (field.kind === "number") {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) values[field.key] = parsed;
    } else {
      values[field.key] = raw;
    }
  }
  return values;
}

export function DetailFields({
  category,
  state,
  onChange,
}: {
  category: VendorCategory;
  state: DetailState;
  onChange: (key: string, value: string) => void;
}) {
  const t = useTranslations("Vendors");
  const fields = DETAIL_FIELDS[category];
  if (fields.length === 0) return null;
  // Libellés par catégorie : « Coiffure de la mariée » n'est pas « Maquillage de la mariée ».
  const label = (field: DetailField) => t(`details.${category}.${field.key}` as "details.cake.style");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `vendor-detail-${field.key}`;
        const value = state[field.key] ?? "";
        const wide = field.kind === "longText";
        return (
          <div key={field.key} className={cn("flex flex-col gap-2", wide && "sm:col-span-2")}>
            <Label htmlFor={id}>{label(field)}</Label>
            {field.kind === "select" ? (
              <Select value={value || UNSET} onValueChange={(next) => onChange(field.key, next === UNSET ? "" : next)}>
                <SelectTrigger id={id} className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{t("options.unset")}</SelectItem>
                  {field.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`options.${field.key}.${option}` as "options.kind.dj")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.kind === "longText" ? (
              <textarea
                id={id}
                value={value}
                maxLength={field.max}
                rows={2}
                onChange={(event) => onChange(field.key, event.target.value)}
                className={textareaClass}
              />
            ) : (
              <Input
                id={id}
                type={field.kind === "date" ? "date" : "text"}
                inputMode={field.kind === "number" ? "numeric" : undefined}
                value={value}
                maxLength={field.kind === "text" ? field.max : undefined}
                onChange={(event) =>
                  onChange(
                    field.key,
                    field.kind === "number" ? onlyDigits(event.target.value, String(field.max).length) : event.target.value,
                  )
                }
                className={cn(fieldClass, field.kind === "number" && "w-28")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// — Questions posées —

/** Les questions du guide, à cocher au fil des échanges avec ce prestataire. */
export function QuestionChecklist({
  category,
  asked,
  onChange,
}: {
  category: VendorCategory;
  asked: number[];
  onChange: (asked: number[]) => void;
}) {
  const t = useTranslations("Vendors");
  const questions = t(`categories.${category}.questions`).split("|").slice(0, QUESTION_COUNTS[category]);

  return (
    // Repliée par défaut : on l'ouvre pour cocher les questions posées.
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("questionsUi.title")}</span>
          <span className="text-xs text-stone">
            {t("questionsUi.progress", { count: asked.length, total: questions.length })}
          </span>
        </span>
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-stone transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-stone">{t("questionsUi.lead")}</p>
        <ul className="flex flex-col gap-1.5">
          {questions.map((question, index) => (
            <li key={question}>
              <label className="flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm leading-5 hover:bg-linen/60">
                <input
                  type="checkbox"
                  checked={asked.includes(index)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...asked, index].sort((a, b) => a - b)
                        : asked.filter((value) => value !== index),
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-sage-deep"
                />
                <span className={asked.includes(index) ? "text-stone line-through decoration-sand" : ""}>{question}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

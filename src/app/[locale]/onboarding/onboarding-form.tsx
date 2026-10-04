"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StylePicker } from "@/app/[locale]/date-night/_components/style-picker";
import type { WeddingStyle } from "@/lib/date-night/schema";
import {
  ONBOARDING_BUDGET,
  ONBOARDING_GUESTS,
  type Handoff,
  type OnboardingField,
  type OnboardingState,
} from "@/lib/onboarding/schema";
import { createWedding } from "./actions";

const initialState: OnboardingState = { status: "idle" };

type OnboardingFormProps = {
  /** Valeurs issues de Date Night, pour pré-remplir le formulaire. */
  handoff: Handoff;
  currency: string;
  /** Date minimale (ISO) calculée côté serveur pour éviter un écart d'hydratation. */
  minDate: string;
};

export function OnboardingForm({
  handoff,
  currency,
  minDate,
}: OnboardingFormProps) {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(
    createWedding,
    initialState,
  );
  const [style, setStyle] = useState<WeddingStyle | null>(
    handoff.style ?? null,
  );

  const values = state.status === "error" ? state.values : undefined;
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;

  // Après une erreur, React réinitialise le formulaire sur les defaultValue :
  // on y réinjecte la saisie renvoyée par la Server Action.
  const defaultOf = (field: OnboardingField, fallback?: number) =>
    values?.[field] ?? (fallback === undefined ? "" : String(fallback));

  const fieldProps = (field: OnboardingField) => {
    const error = fieldErrors?.[field];
    return {
      id: field,
      name: field,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${field}-error` : undefined,
    };
  };

  const fieldError = (field: OnboardingField) => {
    const error = fieldErrors?.[field];
    return error ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {t(`errors.${error}`)}
      </p>
    ) : null;
  };

  return (
    <form action={formAction} className="flex flex-col gap-10" noValidate>
      <section className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
        <div className="flex flex-col gap-2">
          <Label htmlFor="coupleNames">{t("coupleNames.label")}</Label>
          <Input
            {...fieldProps("coupleNames")}
            type="text"
            autoComplete="off"
            placeholder={t("coupleNames.placeholder")}
            defaultValue={defaultOf("coupleNames")}
            maxLength={200}
            required
            className="h-12 text-base"
          />
          {fieldError("coupleNames")}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="weddingDate">{t("weddingDate.label")}</Label>
          <Input
            {...fieldProps("weddingDate")}
            type="date"
            min={minDate}
            defaultValue={defaultOf("weddingDate")}
            required
            className="h-12 text-base"
          />
          <p className="text-sm text-muted-foreground">
            {t("weddingDate.hint")}
          </p>
          {fieldError("weddingDate")}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget">
              {t("budget.label", { currency: currencySymbol })}
            </Label>
            <Input
              {...fieldProps("budget")}
              type="number"
              inputMode="numeric"
              min={ONBOARDING_BUDGET.min}
              max={ONBOARDING_BUDGET.max}
              step={ONBOARDING_BUDGET.step}
              defaultValue={defaultOf("budget", handoff.budget)}
              required
              className="h-12 text-base tabular-nums"
            />
            {fieldError("budget")}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="guests">{t("guests.label")}</Label>
            <Input
              {...fieldProps("guests")}
              type="number"
              inputMode="numeric"
              min={ONBOARDING_GUESTS.min}
              max={ONBOARDING_GUESTS.max}
              step={1}
              defaultValue={defaultOf("guests", handoff.guests)}
              required
              className="h-12 text-base tabular-nums"
            />
            {fieldError("guests")}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <StylePicker
          value={style}
          onChange={setStyle}
          disabled={pending}
        />
        <input type="hidden" name="style" value={style ?? ""} />
        {/* Coups de cœur du swipe Date Night, enregistrés dans le Style DNA. */}
        {(["venue", "ceremony", "reception"] as const).map(
          (step) =>
            handoff[step] && (
              <input key={step} type="hidden" name={step} value={handoff[step].join(",")} />
            ),
        )}
        {fieldError("style")}
      </div>

      <div className="flex flex-col gap-3">
        {state.status === "error" && state.code === "generic" && (
          <p role="alert" className="text-center text-sm text-destructive">
            {t("errors.generic")}
          </p>
        )}
        {state.status === "error" && state.code === "invalidInput" && (
          <p role="alert" className="text-center text-sm text-destructive">
            {t("errors.invalidInput")}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-14 rounded-2xl text-base"
        >
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUEST_LIMITS, type GuestStatus } from "@/lib/guests/schema";
import { RSVP_STATUSES, type RsvpStatus, type SubmitRsvpResult } from "@/lib/rsvp/schema";
import { cn } from "@/lib/utils";
import { submitRsvp } from "./actions";

type RsvpFormProps = {
  token: string;
  firstName: string;
  status: GuestStatus;
  dietary: string | null;
};

/** Réponse de l'invité : présence et régime, puis remerciement. */
export function RsvpForm({ token, firstName, status, dietary }: RsvpFormProps) {
  const t = useTranslations("Rsvp");
  const answered = status === "invited" ? null : status;
  const [choice, setChoice] = useState<RsvpStatus | null>(answered);
  const [diet, setDiet] = useState(dietary ?? "");
  const [done, setDone] = useState<RsvpStatus | null>(answered);
  const [error, setError] = useState<Extract<SubmitRsvpResult, { ok: false }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choice) return;
    setError(null);
    startTransition(async () => {
      let result: SubmitRsvpResult;
      try {
        result = await submitRsvp({ token, status: choice, dietary: diet });
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (result.ok) setDone(result.status);
      else setError(result.error);
    });
  }

  if (error === "closed") {
    return <p className="rounded-3xl bg-linen px-6 py-8 text-center leading-7 text-stone">{t("closed")}</p>;
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-sage-soft/60 px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-sage-deep text-ivory">
          <CheckIcon aria-hidden className="size-5" strokeWidth={2} />
        </span>
        <p role="status" className="max-w-sm font-serif text-2xl leading-snug text-sage-deep">
          {t(`thanks.${done}`, { firstName })}
        </p>
        <button
          type="button"
          onClick={() => setDone(null)}
          className="text-sm text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
        >
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="mb-3 font-serif text-3xl tracking-tight">{t("question")}</legend>
        {RSVP_STATUSES.map((value) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl bg-card px-5 py-4 ring-1 transition",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              choice === value ? "ring-2 ring-terracotta" : "ring-border hover:ring-sand",
            )}
          >
            <input
              type="radio"
              name="rsvp"
              value={value}
              checked={choice === value}
              onChange={() => setChoice(value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                choice === value ? "border-terracotta bg-terracotta text-ivory" : "border-sand",
              )}
            >
              {choice === value && <CheckIcon className="size-3" strokeWidth={2.5} />}
            </span>
            <span className="text-base">{t(`options.${value}`)}</span>
          </label>
        ))}
      </fieldset>

      {choice !== "declined" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="rsvp-dietary">{t("dietaryLabel")}</Label>
          <Input
            id="rsvp-dietary"
            value={diet}
            onChange={(event) => setDiet(event.target.value)}
            maxLength={GUEST_LIMITS.dietaryRequirements}
            placeholder={t("dietaryPlaceholder")}
            disabled={pending}
            className="h-12 rounded-xl bg-card text-base"
          />
          <p className="text-xs text-stone">{t("dietaryHint")}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={!choice || pending}
        className="inline-flex h-13 items-center justify-center rounded-full bg-terracotta px-8 text-base font-medium text-primary-foreground shadow-[0_14px_34px_-14px_rgba(169,83,58,0.7)] transition-colors hover:bg-[#93462f] disabled:opacity-60 disabled:shadow-none"
      >
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}

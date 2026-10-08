"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition, type ReactNode } from "react";
import { WeddingPhotoEditor } from "@/components/wedding-photo/wedding-photo-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Link, useRouter } from "@/i18n/navigation";
import {
  CEREMONY_TYPES,
  parseGuestList,
  STEP_TWO_LIMITS,
  STEP_TWO_VENDORS,
  type StepTwoBlock,
  type StepTwoFieldError,
  type StepTwoInput,
} from "@/lib/onboarding/step-two";
import { ATTIRE_CHOICES, MUSIC_CHOICES } from "@/lib/planning/schema";
import { cn } from "@/lib/utils";
import { saveStepTwo } from "./actions";

type StepTwoFormProps = {
  initial: StepTwoInput;
  currency: string;
  /** Date du mariage déjà formatée, ou null. */
  weddingDate: string | null;
  photo: { url: string | null; initials: string };
};

/** Bloc numéroté, titre en Playfair, beaucoup d'air autour. */
function Block({ number, title, lead, children }: { number: number; title: string; lead?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
      <div className="flex flex-col gap-2">
        <span aria-hidden className="font-serif text-sm text-terracotta tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
        <h2 id={id} className="font-serif text-2xl leading-snug sm:text-3xl">
          {title}
        </h2>
        {lead && <p className="text-pretty text-stone">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

/** Choix unique en pastilles : un RadioGroup Shadcn habillé en étiquettes. */
function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <span id={id} className="text-sm font-medium text-charcoal">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={id}
        value={value}
        onValueChange={(next) => onChange(next as T)}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => (
          <Label
            key={option}
            className="flex cursor-pointer items-center gap-2.5 rounded-full bg-linen px-4 py-2.5 text-sm font-normal text-charcoal ring-1 ring-sand transition-colors hover:bg-sage-soft/60 has-[[data-state=checked]]:bg-sage-soft has-[[data-state=checked]]:text-sage-deep has-[[data-state=checked]]:ring-sage"
          >
            <RadioGroupItem value={option} className="border-stone data-checked:border-sage-deep data-checked:bg-sage-deep" />
            {optionLabel(option)}
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}

/** Question oui / non : un Switch Shadcn et sa question en toutes lettres. */
function YesNo({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-base font-normal text-charcoal">
          {label}
        </Label>
        {hint && <p className="text-sm text-pretty text-stone">{hint}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="mt-1 data-checked:bg-sage-deep data-unchecked:bg-sand"
      />
    </div>
  );
}

const fieldClass = "h-12 rounded-xl bg-ivory text-base";

/**
 * Étape 2 de l'onboarding : photo, rétroplanning, direction artistique,
 * lieux, prestataires et invités, un bloc après l'autre. Tout est facultatif.
 */
export function StepTwoForm({ initial, currency, weddingDate, photo }: StepTwoFormProps) {
  const t = useTranslations("OnboardingStepTwo");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, StepTwoFieldError>>({});
  const [notice, setNotice] = useState<{ kind: "error" | "partial"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  const guestCount = parseGuestList(state.guests.list).length;

  const update = <K extends keyof StepTwoInput>(key: K, value: StepTwoInput[K]) =>
    setState((current) => ({ ...current, [key]: value }));
  const errorOf = (path: string) =>
    fieldErrors[path] ? (
      <p id={`${path}-error`} className="text-sm text-destructive">
        {t(`errors.${fieldErrors[path]}`)}
      </p>
    ) : null;
  const invalid = (path: string) =>
    fieldErrors[path] ? { "aria-invalid": true, "aria-describedby": `${path}-error` } : {};

  function submit() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveStepTwo(state).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (result.ok) {
        router.push("/dashboard");
        return;
      }
      if (result.error === "invalid") {
        setFieldErrors(result.fieldErrors);
        setNotice({ kind: "error", message: t("errors.invalid") });
        return;
      }
      setFieldErrors({});
      if (result.error === "partial") {
        const blocks = result.failed.map((block: StepTwoBlock) => t(`blocks.${block}`)).join(", ");
        setNotice({ kind: "partial", message: t("errors.partial", { blocks }) });
        return;
      }
      setNotice({ kind: "error", message: t(`errors.${result.error}`) });
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-8"
    >
      <Block number={1} title={t("photo.title")} lead={t("photo.lead")}>
        <div className="flex items-center gap-5">
          <WeddingPhotoEditor photoUrl={photo.url} initials={photo.initials} canEdit className="size-24" />
          <p className="text-sm text-pretty text-stone">{t("photo.hint")}</p>
        </div>
      </Block>

      <Block number={2} title={t("planning.title")} lead={t("planning.lead")}>
        {weddingDate && <p className="font-serif text-lg text-sage-deep">{t("planning.date", { date: weddingDate })}</p>}
        <ChoiceGroup
          label={t("planning.ceremony.label")}
          value={state.planning.ceremony}
          options={CEREMONY_TYPES}
          optionLabel={(option) => t(`planning.ceremony.${option}`)}
          onChange={(ceremony) => update("planning", { ...state.planning, ceremony })}
        />
        <ChoiceGroup
          label={t("planning.music.label")}
          value={state.planning.music}
          options={MUSIC_CHOICES}
          optionLabel={(option) => t(`planning.music.${option}`)}
          onChange={(music) => update("planning", { ...state.planning, music })}
        />
        <ChoiceGroup
          label={t("planning.attire.label")}
          value={state.planning.attire}
          options={ATTIRE_CHOICES}
          optionLabel={(option) => t(`planning.attire.${option}`)}
          onChange={(attire) => update("planning", { ...state.planning, attire })}
        />
        <YesNo
          id="step2-accommodation"
          label={t("planning.accommodation.label")}
          hint={t("planning.accommodation.hint")}
          checked={state.planning.guestAccommodation}
          onChange={(guestAccommodation) => update("planning", { ...state.planning, guestAccommodation })}
        />
      </Block>

      <Block number={3} title={t("pinterest.title")} lead={t("pinterest.lead")}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="step2-pinterest">{t("pinterest.label")}</Label>
          <Input
            id="step2-pinterest"
            type="url"
            inputMode="url"
            value={state.pinterestUrl}
            placeholder={t("pinterest.placeholder")}
            onChange={(event) => update("pinterestUrl", event.target.value)}
            className={fieldClass}
            {...invalid("pinterestUrl")}
          />
          {errorOf("pinterestUrl")}
        </div>
      </Block>

      <Block number={4} title={t("venues.title")}>
        <YesNo
          id="step2-venues"
          label={t("venues.question")}
          hint={t("venues.hint")}
          checked={state.venues.enabled}
          onChange={(enabled) => update("venues", { ...state.venues, enabled })}
        />
        {state.venues.enabled && (
          <div className="grid gap-4 sm:grid-cols-3">
            {state.venues.names.map((name, index) => {
              const path = `venues.names.${index}`;
              return (
                <div key={index} className="flex flex-col gap-2">
                  <Label htmlFor={`step2-venue-${index}`}>{t("venues.label", { number: index + 1 })}</Label>
                  <Input
                    id={`step2-venue-${index}`}
                    value={name}
                    maxLength={120}
                    placeholder={index === 0 ? t("venues.placeholder") : undefined}
                    onChange={(event) =>
                      update("venues", {
                        ...state.venues,
                        names: state.venues.names.map((current, i) => (i === index ? event.target.value : current)),
                      })
                    }
                    className={fieldClass}
                    {...invalid(path)}
                  />
                  {errorOf(path)}
                </div>
              );
            })}
          </div>
        )}
      </Block>

      <Block number={5} title={t("vendors.title")} lead={t("vendors.lead")}>
        <ul className="flex flex-col divide-y divide-border">
          {STEP_TWO_VENDORS.map((category) => {
            const vendor = state.vendors[category];
            const setVendor = (next: Partial<typeof vendor>) =>
              update("vendors", { ...state.vendors, [category]: { ...vendor, ...next } });
            return (
              <li key={category} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor={`step2-vendor-${category}`} className="font-serif text-lg font-normal text-charcoal">
                    {t(`vendors.labels.${category}`)}
                  </Label>
                  <div className="flex items-center gap-3">
                    {!vendor.enabled && (
                      <span className="rounded-full bg-terracotta-soft/70 px-3 py-1 text-xs text-terracotta">
                        {t("vendors.toFind")}
                      </span>
                    )}
                    <Switch
                      id={`step2-vendor-${category}`}
                      checked={vendor.enabled}
                      onCheckedChange={(enabled) => setVendor({ enabled })}
                      className="data-checked:bg-sage-deep data-unchecked:bg-sand"
                    />
                  </div>
                </div>
                {vendor.enabled && (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`step2-vendor-${category}-name`}>{t("vendors.name")}</Label>
                      <Input
                        id={`step2-vendor-${category}-name`}
                        value={vendor.name}
                        maxLength={120}
                        placeholder={t("vendors.namePlaceholder")}
                        onChange={(event) => setVendor({ name: event.target.value })}
                        className={fieldClass}
                        {...invalid(`vendors.${category}.name`)}
                      />
                      {errorOf(`vendors.${category}.name`)}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`step2-vendor-${category}-budget`}>
                        {t("vendors.budget", { currency: currencySymbol })}
                      </Label>
                      <Input
                        id={`step2-vendor-${category}-budget`}
                        inputMode="numeric"
                        value={vendor.budget}
                        onChange={(event) => setVendor({ budget: event.target.value })}
                        className={cn(fieldClass, "tabular-nums")}
                        {...invalid(`vendors.${category}.budget`)}
                      />
                      {errorOf(`vendors.${category}.budget`)}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Block>

      <Block number={6} title={t("guests.title")}>
        <YesNo
          id="step2-guests"
          label={t("guests.question")}
          hint={t("guests.hint")}
          checked={state.guests.enabled}
          onChange={(enabled) => update("guests", { ...state.guests, enabled })}
        />
        {state.guests.enabled && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="step2-guest-list">{t("guests.label")}</Label>
              <span
                className={cn(
                  "text-sm tabular-nums",
                  guestCount > STEP_TWO_LIMITS.guests ? "text-destructive" : "text-stone",
                )}
              >
                {t("guests.count", { count: guestCount })}
              </span>
            </div>
            <textarea
              id="step2-guest-list"
              rows={8}
              value={state.guests.list}
              placeholder={t("guests.placeholder")}
              onChange={(event) => update("guests", { ...state.guests, list: event.target.value })}
              className="w-full rounded-xl border border-input bg-ivory px-4 py-3 text-base leading-7 outline-none placeholder:text-stone/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              {...invalid("guests.list")}
            />
            {errorOf("guests.list")}
          </div>
        )}
      </Block>

      <div className="flex flex-col items-center gap-4 pt-2">
        {notice && (
          <div
            role="alert"
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-2xl px-5 py-4 text-center text-sm",
              notice.kind === "partial" ? "bg-linen text-charcoal" : "bg-terracotta-soft/60 text-charcoal",
            )}
          >
            <p className="text-pretty">{notice.message}</p>
            {notice.kind === "partial" && (
              <Link href="/dashboard" className="font-medium text-sage-deep underline underline-offset-4">
                {t("errors.continue")}
              </Link>
            )}
          </div>
        )}
        {/* Enregistré en partie : un second envoi dupliquerait ce qui est déjà créé. */}
        {notice?.kind !== "partial" && (
          <>
            <Button type="submit" size="lg" disabled={pending} className="h-14 w-full rounded-2xl text-base">
              {pending ? t("submitting") : t("submit")}
            </Button>
            <Link
              href="/dashboard"
              className="text-sm text-stone underline decoration-sand underline-offset-4 hover:text-charcoal"
            >
              {t("skip")}
            </Link>
          </>
        )}
      </div>
    </form>
  );
}

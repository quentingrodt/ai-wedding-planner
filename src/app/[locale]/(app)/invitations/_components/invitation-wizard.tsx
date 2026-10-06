"use client";

import { ArrowLeftIcon, BookOpenIcon, CheckIcon, RectangleVerticalIcon } from "lucide-react";
import Image from "next/image";
import { useMessages, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { BROWSER_FAMILIES } from "@/components/invitations/fonts";
import {
  ResponsiveInvitation,
  type InvitationView,
} from "@/components/invitations/responsive-invitation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";
import { NAME_FONT } from "@/lib/invitations/card";
import {
  composeInvitation,
  INVITATION_TONES,
  placesFor,
  suggestedMoments,
  type CompositionAnswers,
  type InvitationTone,
  type Place,
  type PlaceKind,
} from "@/lib/invitations/compose";
import { MomentIconSvg } from "@/lib/invitations/icons";
import {
  INVITATION_LIMITS,
  MAX_MOMENTS,
  MOMENT_ICONS,
  type InvitationDesign,
  type InvitationFonts,
  type MomentIcon,
} from "@/lib/invitations/schema";
import { TEMPLATE_AMBIANCES, type TemplateAmbiance } from "@/lib/invitations/templates";
import { cn } from "@/lib/utils";
import { saveInvitation } from "../actions";

const STEPS = ["you", "format", "style", "program", "places", "finish"] as const;
type Step = (typeof STEPS)[number];

/** Typographie montrée pour chaque ton (celle du modèle principal peut varier). */
const TONE_FONTS: Record<InvitationTone, InvitationFonts> = {
  classic: "editorial",
  romantic: "script",
  modern: "modern",
};

/** Le temps de la composition : assez pour qu'on la voie, jamais assez pour qu'on l'attende. */
const COMPOSING_MS = 3600;
const RECOMPOSING_MS = 1800;

export type WizardDefaults = {
  names: string;
  dateText: string;
  /** Date courte de couverture (« 24 · 06 · 2027 »), ou chaîne vide. */
  coverDate: string;
  rsvpNote: string;
  /** Ambiance du carnet d'inspiration, ou null. */
  ambiance: TemplateAmbiance | null;
  /** Type de cérémonie connu par le questionnaire de rétroplanning. */
  religious: boolean;
  secular: boolean;
};

type InvitationWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: WizardDefaults;
  /** Un faire-part est déjà enregistré : la proposition le remplacera. */
  replacing: boolean;
  watermark?: string;
  /** Appelé dès qu'une proposition est prête (saved : bien enregistrée). */
  onComposed: (design: InvitationDesign, saved: boolean) => void;
};

/**
 * Première création du faire-part : quelques questions, un temps de
 * composition, puis la proposition, prête à être ajustée dans l'éditeur.
 */
export function InvitationWizard({
  open,
  onOpenChange,
  defaults,
  replacing,
  watermark,
  onComposed,
}: InvitationWizardProps) {
  const t = useTranslations("Invitations");
  const [phase, setPhase] = useState<"questions" | "composing" | "proposal">("questions");
  const [step, setStep] = useState(0);
  const [variant, setVariant] = useState(0);
  const [design, setDesign] = useState<InvitationDesign | null>(null);
  const [view, setView] = useState<InvitationView>("cover");
  const [answers, setAnswers] = useState<CompositionAnswers>(() => ({
    names: defaults.names,
    dateText: defaults.dateText,
    format: "booklet",
    ambiance: defaults.ambiance ?? "chateau",
    tone: "classic",
    moments: suggestedMoments(defaults).map((icon) => ({ icon, time: "" })),
    places: {},
    families: false,
    rsvpNote: defaults.rsvpNote,
    contact: "",
  }));
  const update = (patch: Partial<CompositionAnswers>) => setAnswers((current) => ({ ...current, ...patch }));

  const texts = {
    intro: t("defaults.intro"),
    closingNote: t("defaults.closingNote"),
    families: t("defaults.families"),
    coverDate: defaults.coverDate,
    momentTitles: Object.fromEntries(
      MOMENT_ICONS.map((icon) => [icon, t(`wizard.momentTitles.${icon}`)]),
    ) as Record<MomentIcon, string>,
  };

  async function compose(nextVariant: number) {
    setPhase("composing");
    const composed = composeInvitation(answers, texts, nextVariant);
    const [saved] = await Promise.all([
      saveInvitation(composed).then(
        (result) => result.ok,
        () => false,
      ),
      new Promise((resolve) => setTimeout(resolve, nextVariant === 0 ? COMPOSING_MS : RECOMPOSING_MS)),
    ]);
    setVariant(nextVariant);
    setDesign(composed);
    setView(composed.format === "card" ? "card" : "cover");
    setPhase("proposal");
    onComposed(composed, saved);
  }

  const current: Step = STEPS[step];
  const canContinue = current !== "you" || answers.names.trim() !== "";
  const last = step === STEPS.length - 1;

  let body: ReactNode;
  if (phase === "composing") {
    body = <Composing />;
  } else if (phase === "proposal" && design) {
    body = (
      <Proposal
        design={design}
        view={view}
        onView={setView}
        watermark={watermark}
        onAdjust={() => onOpenChange(false)}
        onAnother={() => compose(variant + 1)}
      />
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-1 w-full shrink-0 bg-linen">
          <div
            className="h-full bg-terracotta transition-[width] duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pt-8 pb-6 sm:px-10">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
              {t("wizard.stepOf", { step: step + 1, total: STEPS.length })}
            </p>
            <DialogTitle className="font-serif text-3xl leading-tight text-balance">
              {t(`wizard.steps.${current}.title`)}
            </DialogTitle>
            <DialogDescription className="text-base text-pretty text-stone">
              {step === 0 && replacing ? t("wizard.replacing") : t(`wizard.steps.${current}.hint`)}
            </DialogDescription>
          </div>
          <StepFields step={current} answers={answers} update={update} />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4 sm:px-10">
          {step > 0 ? (
            <Button variant="ghost" size="lg" className="h-11 rounded-full text-stone" onClick={() => setStep(step - 1)}>
              <ArrowLeftIcon aria-hidden />
              {t("wizard.back")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="lg"
            disabled={!canContinue}
            onClick={() => (last ? compose(0) : setStep(step + 1))}
            className="h-11 rounded-full px-6"
          >
            {last ? t("wizard.compose") : t("wizard.next")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      // Pendant la composition, la fenêtre reste ouverte.
      onOpenChange={(next) => phase !== "composing" && onOpenChange(next)}
    >
      <DialogContent
        closeLabel={t("wizard.close")}
        showCloseButton={phase !== "composing"}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none bg-ivory p-0 sm:h-[min(48rem,92dvh)] sm:w-[min(42rem,92vw)] sm:max-w-none sm:rounded-3xl"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Champs de l'étape en cours. */
function StepFields({
  step,
  answers,
  update,
}: {
  step: Step;
  answers: CompositionAnswers;
  update: (patch: Partial<CompositionAnswers>) => void;
}) {
  const t = useTranslations("Invitations");

  switch (step) {
    case "you":
      return (
        <div className="flex flex-col gap-5">
          <Field id="wizard-names" label={t("wizard.fields.names")}>
            <Input
              id="wizard-names"
              value={answers.names}
              maxLength={INVITATION_LIMITS.names}
              onChange={(event) => update({ names: event.target.value })}
              placeholder="Camille & Thomas"
              className="h-12 rounded-xl bg-card text-lg"
            />
          </Field>
          <Field id="wizard-date" label={t("wizard.fields.date")}>
            <Input
              id="wizard-date"
              value={answers.dateText}
              maxLength={INVITATION_LIMITS.dateText}
              onChange={(event) => update({ dateText: event.target.value })}
              placeholder={t("wizard.placeholders.date")}
              className="h-12 rounded-xl bg-card text-base"
            />
          </Field>
        </div>
      );

    case "format":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["booklet", "card"] as const).map((format) => (
            <Choice
              key={format}
              selected={answers.format === format}
              onSelect={() => update({ format })}
              title={t(`formats.${format}.title`)}
              description={t(`formats.${format}.description`)}
              icon={
                format === "booklet" ? (
                  <BookOpenIcon aria-hidden className="size-6" strokeWidth={1.3} />
                ) : (
                  <RectangleVerticalIcon aria-hidden className="size-6" strokeWidth={1.3} />
                )
              }
            />
          ))}
        </div>
      );

    case "style":
      return (
        <div className="flex flex-col gap-6">
          <div role="group" aria-label={t("wizard.ambianceLabel")} className="grid grid-cols-2 gap-3">
            {TEMPLATE_AMBIANCES.map((ambiance) => {
              const selected = answers.ambiance === ambiance;
              return (
                <button
                  key={ambiance}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({ ambiance })}
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-2xl text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected ? "ring-3 ring-terracotta" : "ring-1 ring-border",
                  )}
                >
                  <Image
                    src={INSPIRATION_PHOTOS.venue[ambiance].src}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 20rem, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                  <span className="absolute bottom-3 left-3 font-serif text-lg text-ivory">
                    {t(`ambiances.${ambiance}`)}
                  </span>
                  {selected && <SelectedMark className="top-3 right-3" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{t("wizard.toneLabel")}</p>
            <div className="grid grid-cols-3 gap-3">
              {INVITATION_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={answers.tone === tone}
                  onClick={() => update({ tone })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl bg-card px-2 py-4 transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    answers.tone === tone ? "ring-2 ring-terracotta" : "ring-1 ring-border hover:ring-sand",
                  )}
                >
                  <span
                    aria-hidden
                    className="text-3xl leading-none"
                    style={{
                      fontFamily: BROWSER_FAMILIES[NAME_FONT[TONE_FONTS[tone]]],
                      fontSize: tone === "modern" ? "2.6rem" : undefined,
                    }}
                  >
                    Aa
                  </span>
                  <span className="text-sm">{t(`wizard.tones.${tone}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case "program": {
      const chosen = new Set(answers.moments.map((moment) => moment.icon));
      const full = chosen.size >= MAX_MOMENTS;
      const toggle = (icon: MomentIcon) =>
        update({
          moments: chosen.has(icon)
            ? answers.moments.filter((moment) => moment.icon !== icon)
            : [...answers.moments, { icon, time: "" }],
        });
      const ordered = MOMENT_ICONS.filter((icon) => chosen.has(icon));
      return (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MOMENT_ICONS.map((icon) => {
              const selected = chosen.has(icon);
              return (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && full}
                  onClick={() => toggle(icon)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-sm transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40",
                    selected ? "bg-sage-soft ring-2 ring-sage" : "bg-card ring-1 ring-border hover:ring-sand",
                  )}
                >
                  <MomentIconSvg icon={icon} color="currentColor" size={34} />
                  {t(`wizard.momentTitles.${icon}`)}
                </button>
              );
            })}
          </div>
          {full && <p className="text-xs text-stone">{t("program.max", { count: MAX_MOMENTS })}</p>}
          {ordered.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">{t("wizard.timesLabel")}</p>
              {ordered.map((icon) => (
                <div key={icon} className="flex items-center gap-3">
                  <Label htmlFor={`wizard-time-${icon}`} className="flex-1 text-base font-normal">
                    {t(`wizard.momentTitles.${icon}`)}
                  </Label>
                  <Input
                    id={`wizard-time-${icon}`}
                    value={answers.moments.find((moment) => moment.icon === icon)?.time ?? ""}
                    maxLength={INVITATION_LIMITS.time}
                    placeholder={t("program.placeholders.time")}
                    onChange={(event) =>
                      update({
                        moments: answers.moments.map((moment) =>
                          moment.icon === icon ? { ...moment, time: event.target.value } : moment,
                        ),
                      })
                    }
                    className="h-11 w-28 rounded-xl bg-card text-base"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "places": {
      const kinds = placesFor(answers.moments.map((moment) => moment.icon));
      const setPlace = (kind: PlaceKind, patch: Partial<Place>) =>
        update({
          places: {
            ...answers.places,
            [kind]: { venue: "", address: "", ...answers.places[kind], ...patch },
          },
        });
      if (kinds.length === 0) {
        return <p className="rounded-2xl bg-linen px-4 py-3 text-sm text-stone">{t("wizard.noPlaces")}</p>;
      }
      return (
        <div className="flex flex-col gap-6">
          {kinds.map((kind) => (
            <fieldset key={kind} className="flex flex-col gap-3">
              <legend className="mb-1 font-serif text-xl">{t(`wizard.places.${kind}.title`)}</legend>
              {(kind === "ceremony" || kind === "brunch") && kinds.includes("reception") && (
                <p className="-mt-1 text-xs text-stone">{t("wizard.sameAsReception")}</p>
              )}
              <Input
                aria-label={t("wizard.fields.venue")}
                value={answers.places[kind]?.venue ?? ""}
                maxLength={INVITATION_LIMITS.venue}
                placeholder={t(`wizard.places.${kind}.venue`)}
                onChange={(event) => setPlace(kind, { venue: event.target.value })}
                className="h-11 rounded-xl bg-card text-base"
              />
              <Input
                aria-label={t("wizard.fields.address")}
                value={answers.places[kind]?.address ?? ""}
                maxLength={INVITATION_LIMITS.address}
                placeholder={t(`wizard.places.${kind}.address`)}
                onChange={(event) => setPlace(kind, { address: event.target.value })}
                className="h-11 rounded-xl bg-card text-base"
              />
            </fieldset>
          ))}
        </div>
      );
    }

    case "finish":
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">{t("wizard.familiesQuestion")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                selected={!answers.families}
                onSelect={() => update({ families: false })}
                title={t("wizard.familiesNo.title")}
                description={t("wizard.familiesNo.description")}
              />
              <Choice
                selected={answers.families}
                onSelect={() => update({ families: true })}
                title={t("wizard.familiesYes.title")}
                description={t("wizard.familiesYes.description")}
              />
            </div>
          </div>
          <Field id="wizard-rsvp" label={t("fields.rsvpNote")}>
            <Input
              id="wizard-rsvp"
              value={answers.rsvpNote}
              maxLength={INVITATION_LIMITS.rsvpNote}
              onChange={(event) => update({ rsvpNote: event.target.value })}
              className="h-11 rounded-xl bg-card text-base"
            />
          </Field>
          <Field id="wizard-contact" label={t("wizard.fields.contact")}>
            <Input
              id="wizard-contact"
              value={answers.contact}
              maxLength={INVITATION_LIMITS.contact}
              placeholder={t("placeholders.contact")}
              onChange={(event) => update({ contact: event.target.value })}
              className="h-11 rounded-xl bg-card text-base"
            />
          </Field>
        </div>
      );
  }
}

/** Le temps de la composition : une carte qui se dessine, et ce qui se décide. */
function Composing() {
  const t = useTranslations("Invitations");
  const steps = useMessages().Invitations.wizard.composing as string[];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setIndex((current) => Math.min(current + 1, steps.length - 1)),
      COMPOSING_MS / steps.length,
    );
    return () => clearInterval(interval);
  }, [steps.length]);

  // Lignes de la carte en attente de texte.
  const lines = ["mx-auto h-6 w-3/4", "mx-auto h-2.5 w-1/2", "mx-auto mt-4 h-px w-1/4", "mx-auto h-3 w-2/5", "mx-auto mt-4 h-2.5 w-3/5", "mx-auto h-2.5 w-1/2", "mx-auto h-2.5 w-2/5"];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10">
      <DialogTitle className="sr-only">{t("wizard.composingTitle")}</DialogTitle>
      <div className="flex aspect-[600/851] w-44 flex-col justify-center gap-3 rounded-sm bg-card px-6 shadow-[0_30px_60px_-30px_rgba(43,42,40,0.45)] ring-1 ring-border sm:w-52">
        {lines.map((className, line) => (
          <Skeleton
            key={line}
            className={cn("rounded-full bg-sand/70", className)}
            // Décalage ligne à ligne : la carte semble se dessiner de haut en bas.
            style={{ animationDelay: `${line * 180}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-serif text-2xl">{t("wizard.composingTitle")}</p>
        <p aria-live="polite" className="text-stone">
          {steps[index]}
        </p>
      </div>
    </div>
  );
}

/** La proposition : le faire-part en grand, puis ce qu'on peut en faire. */
function Proposal({
  design,
  view,
  onView,
  watermark,
  onAdjust,
  onAnother,
}: {
  design: InvitationDesign;
  view: InvitationView;
  onView: (view: InvitationView) => void;
  watermark?: string;
  onAdjust: () => void;
  onAnother: () => void;
}) {
  const t = useTranslations("Invitations");
  const booklet = design.format === "booklet";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto px-6 pt-8 pb-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t(`templates.${design.template}`)}
          </p>
          <DialogTitle className="font-serif text-3xl">{t("wizard.proposalTitle")}</DialogTitle>
          <DialogDescription className="text-stone">{t("wizard.proposalHint")}</DialogDescription>
        </div>
        {booklet && (
          <div role="group" aria-label={t("views.label")} className="inline-flex rounded-full bg-linen p-1">
            {(["cover", "inside", "back"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => onView(value)}
                className={cn(
                  "h-8 rounded-full px-3.5 text-sm text-stone transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  view === value && "bg-card text-charcoal shadow-sm",
                )}
              >
                {t(`views.${value}`)}
              </button>
            ))}
          </div>
        )}
        <div className={cn("w-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95", view === "inside" ? "max-w-xl" : "max-w-72")}>
          <ResponsiveInvitation key={view} design={design} view={view} watermark={watermark} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-between sm:px-10">
        <Button variant="ghost" size="lg" className="h-11 rounded-full text-stone" onClick={onAnother}>
          {t("wizard.another")}
        </Button>
        <Button size="lg" className="h-11 rounded-full px-6" onClick={onAdjust}>
          {t("wizard.adjust")}
        </Button>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SelectedMark({ className }: { className?: string }) {
  return (
    <span className={cn("absolute flex size-6 items-center justify-center rounded-full bg-terracotta text-ivory", className)}>
      <CheckIcon aria-hidden className="size-3.5" strokeWidth={2} />
    </span>
  );
}

/** Grande option à choisir, avec un titre et une phrase d'explication. */
function Choice({
  selected,
  onSelect,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl bg-card p-5 text-left transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "ring-2 ring-terracotta" : "ring-1 ring-border hover:ring-sand",
      )}
    >
      {icon && <span className="text-sage-deep">{icon}</span>}
      <span className="pr-8 font-medium">{title}</span>
      <span className="text-sm text-stone">{description}</span>
      {selected && <SelectedMark className="top-4 right-4" />}
    </button>
  );
}

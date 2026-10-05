"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useMessages, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { SwipeDeck } from "@/components/inspiration/swipe-deck";
import {
  INSPIRATION_OPTIONS,
  INSPIRATION_SECTIONS,
  INSPIRATION_STEPS,
  type InspirationLikes,
  type InspirationOption,
  type InspirationSection,
  type InspirationStep,
} from "@/lib/inspiration/catalog";
import { INSPIRATION_PHOTOS, type InspirationPhoto } from "@/lib/inspiration/photos";
import { cn } from "@/lib/utils";
import type { StoredWeddingPlan } from "@/lib/plan/schema";
import { saveInspirationStep } from "../actions";
import { WeddingPlanSection } from "./wedding-plan";

type InspirationBookProps = {
  initialLikes: InspirationLikes;
  /** Owner ou partner : seuls les mariés complètent le carnet (et voient le plan). */
  canEdit: boolean;
  initialPlan: StoredWeddingPlan | null;
  currency: string;
};

type Playing = {
  step: InspirationStep;
  /** Enchaîner automatiquement les étapes restantes (« Continuer mon carnet »). */
  continuous: boolean;
};

/** Carnet d'inspiration : vue d'ensemble des 11 étapes et swipe étape par étape. */
export function InspirationBook({
  initialLikes,
  canEdit,
  initialPlan,
  currency,
}: InspirationBookProps) {
  const t = useTranslations("Inspiration.book");
  const tSteps = useTranslations("Inspiration.steps");
  const [likes, setLikes] = useState<InspirationLikes>(initialLikes);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [saveError, setSaveError] = useState(false);
  // Seule la section de la prochaine étape à jouer est dépliée à l'arrivée.
  const [openSections, setOpenSections] = useState<ReadonlySet<InspirationSection>>(() => {
    const next = INSPIRATION_STEPS.find((step) => initialLikes[step] === undefined);
    const section = INSPIRATION_SECTIONS.find((s) => (s.steps as readonly string[]).includes(next ?? ""));
    return new Set(section ? [section.key] : []);
  });

  function toggleSection(key: InspirationSection) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const [, startTransition] = useTransition();

  const remaining = INSPIRATION_STEPS.filter((step) => likes[step] === undefined);
  const done = INSPIRATION_STEPS.length - remaining.length;

  // Changement de vue : on revient en haut de page.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [playing?.step]);

  function completeStep<S extends InspirationStep>(step: S, stepLikes: InspirationOption<S>[]) {
    const previous = likes[step];
    setLikes((current) => ({ ...current, [step]: stepLikes }));
    setSaveError(false);

    // Optimiste : on avance tout de suite, et on revient en arrière si l'écriture échoue.
    startTransition(async () => {
      const result = await saveInspirationStep(step, stepLikes);
      if (!result.ok) {
        setLikes((current) => ({ ...current, [step]: previous }));
        setSaveError(true);
      }
    });

    const next = playing?.continuous
      ? INSPIRATION_STEPS.find((s) => s !== step && likes[s] === undefined)
      : undefined;
    setPlaying(next ? { step: next, continuous: true } : null);
  }

  if (playing) {
    const { step } = playing;
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setPlaying(null)}
            className="inline-flex w-fit items-center gap-2 text-sm text-stone transition-colors hover:text-charcoal"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
            {t("back")}
          </button>
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {tSteps(`${step}.label`)} ·{" "}
            {t("stepOf", {
              current: INSPIRATION_STEPS.indexOf(step) + 1,
              total: INSPIRATION_STEPS.length,
            })}
          </p>
          <h1 className="text-3xl leading-tight tracking-tight text-balance sm:text-5xl">
            {tSteps(`${step}.title`)}
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">{tSteps(`${step}.subtitle`)}</p>
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {t("saveError")}
            </p>
          )}
        </header>
        {/* key : un paquet neuf (index, coups de cœur) à chaque étape */}
        <SwipeDeck
          key={step}
          step={step}
          onComplete={(stepLikes: InspirationOption<typeof step>[]) => completeStep(step, stepLikes)}
        />
      </div>
    );
  }

  const nextStep = remaining[0];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
        </div>
        <h1 className="text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">{t("intro")}</p>

        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={INSPIRATION_STEPS.length}
            aria-valuenow={done}
            aria-valuetext={t("progress", { done, total: INSPIRATION_STEPS.length })}
            className="flex gap-1"
          >
            {INSPIRATION_STEPS.map((step) => (
              <span
                key={step}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors duration-500",
                  likes[step] !== undefined ? "bg-terracotta" : "bg-sand",
                )}
              />
            ))}
          </div>
          <p className="text-sm text-stone">
            {t("progress", { done, total: INSPIRATION_STEPS.length })}
          </p>
        </div>

        {canEdit && nextStep && (
          <button
            type="button"
            onClick={() => setPlaying({ step: nextStep, continuous: true })}
            className="inline-flex h-12 w-fit items-center gap-3 rounded-full bg-terracotta px-7 text-sm font-medium text-primary-foreground shadow-[0_10px_30px_-12px_rgba(169,83,58,0.6)] transition-colors hover:bg-[#93462f]"
          >
            {done === 0 ? t("start") : t("continue")}
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        )}
        {!canEdit && <p className="text-sm text-stone">{t("readOnly")}</p>}
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            {t("saveError")}
          </p>
        )}
      </header>

      {canEdit ? (
        <WeddingPlanSection
          initialPlan={initialPlan}
          complete={!nextStep}
          canGenerate={canEdit}
          currency={currency}
        />
      ) : (
        !nextStep && (
          <section className="flex flex-col gap-2 rounded-2xl bg-sage-soft/60 p-6 text-sage-deep">
            <h2 className="text-2xl tracking-tight">{t("complete.title")}</h2>
            <p className="leading-7">{t("complete.body")}</p>
          </section>
        )
      )}

      <div className="flex flex-col border-t border-sand">
        {INSPIRATION_SECTIONS.map((section) => {
          const open = openSections.has(section.key);
          const panelId = `section-${section.key}`;
          const played = section.steps.filter((step) => likes[step] !== undefined);

          return (
            <section key={section.key} className="border-b border-sand">
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggleSection(section.key)}
                  className="group flex w-full items-center gap-4 py-6 text-left"
                >
                  <span className="font-serif text-2xl tracking-tight transition-colors group-hover:text-terracotta">
                    {t(`sections.${section.key}`)}
                  </span>
                  {/* Aperçu discret : les couvertures des étapes déjà jouées */}
                  <span className="flex -space-x-2" aria-hidden>
                    {played.slice(0, 4).map((step) => (
                      <span
                        key={step}
                        className="relative size-7 overflow-hidden rounded-full ring-2 ring-ivory"
                      >
                        <Image src={coverOf(step, likes[step]).src} alt="" fill sizes="28px" className="object-cover" />
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto text-sm text-stone tabular-nums">
                    {played.length} / {section.steps.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-stone transition-transform duration-300",
                      open && "rotate-180",
                    )}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              </h2>
              {/* Repli animé (grid-rows 0fr → 1fr) ; inert retire les cartes du parcours clavier. */}
              <div
                id={panelId}
                inert={!open}
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <ul className="grid gap-4 pb-8 sm:grid-cols-2">
                    {section.steps.map((step) => (
                      <StepCard
                        key={step}
                        step={step}
                        index={INSPIRATION_STEPS.indexOf(step)}
                        likes={likes[step]}
                        canEdit={canEdit}
                        onPlay={() => setPlaying({ step, continuous: false })}
                      />
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  likes,
  canEdit,
  onPlay,
}: {
  step: InspirationStep;
  index: number;
  likes: readonly string[] | undefined;
  canEdit: boolean;
  onPlay: () => void;
}) {
  const t = useTranslations("Inspiration.book");
  const tSteps = useTranslations("Inspiration.steps");
  // Textes et photos de l'étape d'un bloc : clés dynamiques « étape.choix ».
  const names = useMessages().Inspiration.options[step] as Record<string, { name: string }>;
  const played = likes !== undefined;
  const cover = coverOf(step, likes);

  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={cover.src}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className={cn(
            "object-cover transition duration-700 group-hover:scale-[1.03]",
            !played && "opacity-70 grayscale-[60%]",
          )}
        />
        <span className="absolute top-3 left-3 rounded-full bg-ivory/90 px-3 py-1 font-serif text-sm italic">
          {String(index + 1).padStart(2, "0")}
        </span>
        {played && (
          <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-sage-deep text-ivory">
            <Check className="size-4" strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-xl leading-snug tracking-tight">{tSteps(`${step}.label`)}</h3>
        <div className="flex flex-1 flex-wrap content-start gap-2">
          {!played && <span className="text-sm text-stone/80 italic">{t("todo")}</span>}
          {played && likes.length === 0 && (
            <span className="text-sm text-stone/80 italic">{t("noLikes")}</span>
          )}
          {likes?.map((option) => (
            <span key={option} className="rounded-full bg-linen px-3 py-1 text-sm">
              {names[option]?.name}
            </span>
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onPlay}
            className="mt-1 inline-flex w-fit items-center gap-2 text-sm font-medium text-sage-deep underline decoration-sage/40 underline-offset-4 transition-colors hover:decoration-sage-deep"
          >
            {played ? (
              <>
                <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden />
                {t("replay")}
              </>
            ) : (
              <>
                {t("play")}
                <ArrowRight className="size-3.5" strokeWidth={1.5} aria-hidden />
              </>
            )}
          </button>
        )}
      </div>
    </li>
  );
}

/** Photo de couverture d'une étape : le premier coup de cœur, sinon le premier choix. */
function coverOf(step: InspirationStep, likes: readonly string[] | undefined): InspirationPhoto {
  const photos = INSPIRATION_PHOTOS[step] as Record<string, InspirationPhoto>;
  return photos[likes?.[0] ?? INSPIRATION_OPTIONS[step][0]];
}

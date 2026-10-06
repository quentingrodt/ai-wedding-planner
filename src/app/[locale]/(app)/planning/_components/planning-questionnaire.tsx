"use client";

import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { savePlanningAnswers } from "@/lib/planning/actions";
import {
  PLANNING_QUESTIONS,
  chooseOption,
  chooseOptions,
  currentOption,
  currentOptions,
} from "@/lib/planning/questionnaire";
import { DEFAULT_PLANNING_ANSWERS, type PlanningAnswers } from "@/lib/planning/schema";
import { cn } from "@/lib/utils";

type PlanningQuestionnaireProps = {
  /** Réponses enregistrées, pour pré-sélectionner les cartes ; null au premier passage. */
  initialAnswers: PlanningAnswers | null;
  /** Retour au rétroplanning sans rien changer ; absent au premier passage. */
  onCancel?: () => void;
  onSaved: () => void;
};

const optionClass = (selected: boolean) =>
  cn(
    "flex items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-base ring-1 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    selected ? "bg-sage-soft ring-sage" : "bg-ivory ring-border hover:bg-linen hover:ring-sand",
  );

/**
 * Questionnaire d'accompagnement, une question par carte. Question simple :
 * un clic passe à la suivante ; question multiple : on coche puis on valide.
 * La dernière réponse compose aussitôt le rétroplanning (savePlanningAnswers).
 */
export function PlanningQuestionnaire({
  initialAnswers,
  onCancel,
  onSaved,
}: PlanningQuestionnaireProps) {
  const t = useTranslations("Planning.questionnaire");
  const [answers, setAnswers] = useState<PlanningAnswers>(
    initialAnswers ?? DEFAULT_PLANNING_ANSWERS,
  );
  // Questions simples déjà répondues pendant ce passage.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const question = PLANNING_QUESTIONS[index];
  const total = PLANNING_QUESTIONS.length;
  const isMulti = question.kind === "multi";
  const selected =
    picked[question.id] ?? (initialAnswers ? currentOption(question, initialAnswers) : null);
  // Questions multiples : la sélection part des réponses en cours (défauts compris).
  const [multi, setMulti] = useState<string[]>(() =>
    isMulti ? currentOptions(question, answers) : [],
  );

  function goTo(nextIndex: number, nextAnswers: PlanningAnswers) {
    const nextQuestion = PLANNING_QUESTIONS[nextIndex];
    setIndex(nextIndex);
    if (nextQuestion.kind === "multi") setMulti(currentOptions(nextQuestion, nextAnswers));
  }

  function advance(next: PlanningAnswers) {
    setAnswers(next);
    if (index < total - 1) {
      goTo(index + 1, next);
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof savePlanningAnswers>>;
      try {
        result = await savePlanningAnswers(next);
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (!result.ok) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("saved"), { description: initialAnswers ? t("keptNote") : undefined });
      onSaved();
    });
  }

  function choose(option: string) {
    setPicked((current) => ({ ...current, [question.id]: option }));
    advance(chooseOption(question, answers, option));
  }

  function toggle(option: string) {
    setMulti((current) =>
      current.includes(option) ? current.filter((value) => value !== option) : [...current, option],
    );
  }

  const optionLabel = (option: string) =>
    t(`questions.${question.id}.options.${option}` as Parameters<typeof t>[0]);

  if (pending) {
    return (
      <section
        aria-live="polite"
        className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-10"
      >
        <p className="font-serif text-2xl text-pretty">{t("saving")}</p>
        <div className="flex flex-col gap-4" aria-hidden>
          {[0.9, 0.7, 0.8, 0.6].map((width, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="size-6 shrink-0 rounded-full bg-sand/60" />
              <Skeleton className="h-4 rounded-full bg-sand/60" style={{ width: `${width * 100}%` }} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="planning-question"
      className="flex flex-col gap-8 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-10"
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-1" aria-hidden>
          {PLANNING_QUESTIONS.map((step, i) => (
            <span
              key={step.id}
              className={cn(
                "h-0.5 flex-1 rounded-full transition-colors duration-500",
                i <= index ? "bg-terracotta" : "bg-sand",
              )}
            />
          ))}
        </div>
        <p className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">
          {t("step", { current: index + 1, total })}
        </p>
        <h2 id="planning-question" className="font-serif text-3xl leading-tight text-balance">
          {t(`questions.${question.id}.title`)}
        </h2>
        {isMulti && <p className="text-stone">{t("multiHint")}</p>}
      </div>

      <div
        className={cn("grid gap-3", isMulti && question.options.length > 6 && "sm:grid-cols-2")}
        role="group"
        aria-labelledby="planning-question"
      >
        {question.options.map((option) =>
          isMulti ? (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={multi.includes(option)}
              className={optionClass(multi.includes(option))}
            >
              {optionLabel(option)}
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                  multi.includes(option) ? "border-sage bg-sage text-ivory" : "border-sand",
                )}
              >
                {multi.includes(option) && <CheckIcon className="size-3" strokeWidth={2.5} />}
              </span>
            </button>
          ) : (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              aria-pressed={selected === option}
              className={optionClass(selected === option)}
            >
              {optionLabel(option)}
            </button>
          ),
        )}
      </div>

      {isMulti && (
        <button
          type="button"
          onClick={() => advance(chooseOptions(question, answers, multi))}
          className="h-12 self-start rounded-full bg-sage-deep px-6 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
        >
          {multi.length > 0
            ? t("continue")
            : t(`questions.${question.id}.empty` as Parameters<typeof t>[0])}
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => goTo(index - 1, answers)}
            className="inline-flex items-center gap-2 text-sm text-stone transition-colors hover:text-charcoal"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {t("back")}
          </button>
        ) : (
          <span />
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-stone underline-offset-4 transition-colors hover:text-charcoal hover:underline"
          >
            {t("cancel")}
          </button>
        )}
      </div>
    </section>
  );
}

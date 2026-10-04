"use client";

import { useState, useTransition } from "react";
import {
  BUDGET_RANGE,
  GUESTS_RANGE,
  type RealityCheckResponse,
} from "@/lib/date-night/schema";
import {
  DATE_NIGHT_STEPS,
  type DateNightLikes,
  type DateNightStep,
  type InspirationOption,
} from "@/lib/inspiration/catalog";
import { analyzeDateNight } from "../actions";

/** État et logique du tunnel "Date Night", sans aucun rendu. */
export function useDateNight() {
  const [likes, setLikes] = useState<DateNightLikes>({});
  const [budget, setBudgetValue] = useState<number>(BUDGET_RANGE.defaultValue);
  const [guests, setGuestsValue] = useState<number>(GUESTS_RANGE.defaultValue);
  const [result, setResult] = useState<RealityCheckResponse | null>(null);
  const [isAnalyzing, startTransition] = useTransition();

  // Première étape du swipe pas encore jouée ; null = swipe terminé.
  const currentStep = DATE_NIGHT_STEPS.find((step) => likes[step] === undefined) ?? null;
  // Le premier lieu aimé fait référence pour le Reality Check.
  const style = likes.venue?.[0] ?? null;

  function completeStep<S extends DateNightStep>(step: S, stepLikes: InspirationOption<S>[]) {
    setLikes((previous) => ({ ...previous, [step]: stepLikes }));
    setResult(null);
  }

  // Toute modification rend le résultat précédent obsolète.
  function restartInspiration() {
    setLikes({});
    setResult(null);
  }
  function setBudget(value: number) {
    setBudgetValue(value);
    setResult(null);
  }
  function setGuests(value: number) {
    setGuestsValue(value);
    setResult(null);
  }

  function analyze() {
    if (!style) return;
    setResult(null);
    startTransition(async () => {
      let response: RealityCheckResponse;
      try {
        response = await analyzeDateNight({ style, budget, guests });
      } catch {
        response = { status: "error", code: "generic" };
      }
      startTransition(() => setResult(response));
    });
  }

  return {
    likes,
    currentStep,
    style,
    budget,
    guests,
    result,
    isAnalyzing,
    canAnalyze: style !== null && !isAnalyzing,
    completeStep,
    restartInspiration,
    setBudget,
    setGuests,
    analyze,
  };
}

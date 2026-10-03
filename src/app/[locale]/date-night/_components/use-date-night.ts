"use client";

import { useState, useTransition } from "react";
import {
  BUDGET_RANGE,
  GUESTS_RANGE,
  type RealityCheckResponse,
  type WeddingStyle,
} from "@/lib/date-night/schema";
import { analyzeDateNight } from "../actions";

/** État et logique du tunnel "Date Night", sans aucun rendu. */
export function useDateNight() {
  const [style, setStyleValue] = useState<WeddingStyle | null>(null);
  const [budget, setBudgetValue] = useState<number>(BUDGET_RANGE.defaultValue);
  const [guests, setGuestsValue] = useState<number>(GUESTS_RANGE.defaultValue);
  const [result, setResult] = useState<RealityCheckResponse | null>(null);
  const [isAnalyzing, startTransition] = useTransition();

  // Toute modification rend le résultat précédent obsolète.
  function setStyle(value: WeddingStyle) {
    setStyleValue(value);
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
    style,
    budget,
    guests,
    result,
    isAnalyzing,
    canAnalyze: style !== null && !isAnalyzing,
    setStyle,
    setBudget,
    setGuests,
    analyze,
  };
}

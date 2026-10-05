"use client";

import { Lightbulb, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import type { BudgetSuggestion, BudgetSuggestionId } from "@/lib/budget/suggestions";

/** Suggestions visibles avant « Voir plus ». */
const VISIBLE = 3;

type BudgetSuggestionsProps = {
  suggestions: BudgetSuggestion[];
  currency: string;
  /** Clé de stockage des suggestions ignorées (une par mariage). */
  storageKey: string;
  onAdd: (suggestion: BudgetSuggestion, label: string) => void;
};

/**
 * « Avez-vous pensé au DJ ? » : postes probablement oubliés, ajoutables en un
 * clic avec une estimation. « Ignorer » est mémorisé dans le navigateur
 * (confort personnel, sans incidence sur le budget partagé).
 */
export function BudgetSuggestions({
  suggestions,
  currency,
  storageKey,
  onAdd,
}: BudgetSuggestionsProps) {
  const t = useTranslations("Budget.suggestions");
  const format = useFormatter();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, dismiss] = useDismissed(storageKey);

  const visible = suggestions.filter((suggestion) => !dismissed.has(suggestion.id));
  if (visible.length === 0) return null;
  const shown = expanded ? visible : visible.slice(0, VISIBLE);
  const hidden = visible.length - shown.length;

  return (
    <section
      aria-labelledby="suggestions-title"
      className="flex flex-col gap-5 rounded-3xl bg-sage-soft/50 p-6 ring-1 ring-sage-soft sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-sage-deep">
          <Lightbulb className="size-4.5" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="suggestions-title" className="font-serif text-2xl text-sage-deep">
            {t("title")}
          </h2>
          <p className="text-sm leading-6 text-stone">{t("intro")}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {shown.map((suggestion) => (
          <li
            key={suggestion.id}
            className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col">
              <span className="font-medium">{t(`items.${suggestion.id}.question`)}</span>
              {suggestion.estimate !== null && (
                <span className="text-sm text-stone">
                  {t("estimate", {
                    amount: format.number(suggestion.estimate, {
                      style: "currency",
                      currency,
                      maximumFractionDigits: 0,
                    }),
                  })}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onAdd(suggestion, t(`items.${suggestion.id}.label`))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sage-deep px-4 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
              >
                <PlusIcon className="size-4" aria-hidden />
                {t("add")}
              </button>
              <button
                type="button"
                onClick={() => dismiss(suggestion.id)}
                className="h-9 rounded-full px-3 text-sm text-stone transition-colors hover:text-charcoal"
              >
                {t("dismiss")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {(hidden > 0 || expanded) && visible.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-fit text-sm text-sage-deep underline decoration-sage/40 underline-offset-4 hover:decoration-sage-deep"
        >
          {expanded ? t("showLess") : t("showMore", { count: hidden })}
        </button>
      )}
    </section>
  );
}

/**
 * Suggestions ignorées, lues dans localStorage via useSyncExternalStore
 * (rendu serveur : rien d'ignoré ; stockage indisponible : idem).
 */
function useDismissed(
  storageKey: string,
): [ReadonlySet<BudgetSuggestionId>, (id: BudgetSuggestionId) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );

  let ids: BudgetSuggestionId[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is BudgetSuggestionId => typeof v === "string");
  } catch {
    // Valeur illisible : rien d'ignoré.
  }

  function dismiss(id: BudgetSuggestionId) {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...new Set([...ids, id])]));
      window.dispatchEvent(new StorageEvent("storage", { key: storageKey }));
    } catch {
      // Stockage indisponible : la suggestion reviendra au prochain affichage.
    }
  }

  return [new Set(ids), dismiss];
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

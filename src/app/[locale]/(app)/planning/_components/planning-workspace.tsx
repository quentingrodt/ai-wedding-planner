"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PlanningAnswers } from "@/lib/planning/schema";
import { AddTaskDialog } from "./add-task-dialog";
import { PlanningList, type PlanningItem } from "./planning-list";
import { PlanningQuestionnaire } from "./planning-questionnaire";

type PlanningWorkspaceProps = {
  items: PlanningItem[];
  /** Aujourd'hui (ISO) : première date proposée pour une étape personnelle. */
  today: string;
  latestDate: string | null;
  answers: PlanningAnswers | null;
  /** Mariés : questionnaire et recalcul ; témoins : liste et étapes personnelles. */
  canPersonalize: boolean;
};

/**
 * Rétroplanning et questionnaire d'accompagnement : au premier passage, les
 * mariés commencent par les questions ; ensuite, « Ajuster mes réponses » les
 * rouvre et recompose la liste.
 */
export function PlanningWorkspace({
  items,
  today,
  latestDate,
  answers,
  canPersonalize,
}: PlanningWorkspaceProps) {
  const t = useTranslations("Planning");
  const [asking, setAsking] = useState(canPersonalize && answers === null);

  if (asking) {
    return (
      <PlanningQuestionnaire
        initialAnswers={answers}
        onCancel={answers ? () => setAsking(false) : undefined}
        onSaved={() => setAsking(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {canPersonalize && answers === null && (
        <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("notPersonalized")}</p>
      )}
      {!canPersonalize && (
        <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <AddTaskDialog minDate={today} latestDate={latestDate} />
        {canPersonalize && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="h-11 rounded-full px-5 text-sm font-medium text-sage-deep ring-1 ring-sage transition-colors hover:bg-sage-soft"
          >
            {answers === null ? t("personalize") : t("adjust")}
          </button>
        )}
      </div>
      <PlanningList items={items} latestDate={latestDate} />
    </div>
  );
}

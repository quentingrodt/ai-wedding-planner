import { addDaysToIsoDate, daysBetween } from "@/lib/weddings/dates";
import {
  TASK_CATALOG,
  type PlanningHref,
  type PlanningTaskKey,
  type TaskDefinition,
} from "./catalog";
import type {
  PlanningAnswers,
  PlanningContext,
  TaskCategory,
  TaskPace,
} from "./schema";

/*
 * Calcul du rétroplanning selon le temps restant avant le mariage.
 *
 *   H = jours restants, L = H − 7 (une semaine pour démarrer)
 *   r = min(1, L / 365)                       taux de compression
 *   J-x = plancher + (idéal − plancher) × r
 *
 * Avec un an ou plus, chaque tâche tombe à son échéance idéale ; plus le temps
 * manque, plus elle glisse vers son plancher. Les tâches à grande marge se
 * compressent davantage que celles déjà serrées, et l'ordre logique tient.
 *
 * Puis, dans cet ordre :
 * 1. Tâches « dès que possible » (budget, invités, lieu, mairie) ramenées à
 *    J+14 si le temps ne manque pas.
 * 2. Tâches qui tomberaient avant J+7 : file « à lancer tout de suite », deux
 *    par jour, par priorité.
 * 3. Une dépendante reste après sa parente : une semaine d'écart avec un an
 *    devant soi, réduite au prorata de r (2 jours minimum).
 *
 * Aucun appel IA : calcul déterministe, en jours entiers UTC.
 */

/** Horizon d'un planning sans compression (jours). */
export const REFERENCE_HORIZON = 365;
/** Délai laissé au couple pour démarrer (jours). */
export const START_BUFFER = 7;
/** Délai visé pour les tâches « dès que possible » (jours). */
export const ASAP_DELAY = 14;
/** Écart entre une tâche et sa dépendante sans compression (jours). */
export const DEPENDENCY_GAP = 7;
/** Écart minimal entre une tâche et sa dépendante, même compressé (jours). */
const MIN_DEPENDENCY_GAP = 2;
/** Nombre de tâches par jour dans la file des tâches à lancer tout de suite. */
export const QUEUE_TASKS_PER_DAY = 2;
/**
 * Une tâche est serrée si elle perd au moins TIGHT_MIN_LOSS jours sur son
 * échéance idéale, et qu'elle rejoint la file des tâches à lancer tout de
 * suite ou qu'il lui reste moins de TIGHT_SLACK de sa marge (plancher → idéal).
 */
const TIGHT_SLACK = 0.35;
const TIGHT_MIN_LOSS = 30;

export type ScheduledTask = {
  key: PlanningTaskKey;
  category: TaskCategory;
  priority: 1 | 2 | 3;
  dependsOn: PlanningTaskKey | null;
  href: PlanningHref | null;
  /** Jours avant le mariage (≥ 1). */
  daysBefore: number;
  /** Convention de tasks.target_offset_days : négatif (−daysBefore). */
  targetOffsetDays: number;
  dueDate: string;
  pace: TaskPace;
};

export type PlanningSchedule = {
  horizonDays: number;
  /** Taux de compression r, entre 0 et 1 (1 : planning idéal). */
  compression: number;
  /** Tâches triées par échéance, puis par priorité. */
  tasks: ScheduledTask[];
};

type Draft = {
  definition: TaskDefinition;
  index: number;
  raw: number;
  queued: boolean;
  daysBefore: number;
};

export function buildSchedule({
  weddingDate,
  today,
  answers,
  countryCode,
}: {
  weddingDate: string;
  today: string;
  answers: PlanningAnswers;
  countryCode: string | null;
}): PlanningSchedule {
  const horizonDays = daysBetween(today, weddingDate);
  // Mariage demain ou passé : plus rien à planifier.
  if (horizonDays < 2) return { horizonDays, compression: 0, tasks: [] };

  const context: PlanningContext = { answers, countryCode, horizonDays };
  // Échéance la plus lointaine possible (J-x) : une semaine après aujourd'hui,
  // ou la moitié du temps restant si le mariage est dans moins de deux semaines.
  const earliest = Math.max(horizonDays - START_BUFFER, Math.ceil(horizonDays / 2));
  const compression = Math.min(1, earliest / REFERENCE_HORIZON);

  const definitions: readonly TaskDefinition[] = TASK_CATALOG;
  const drafts: Draft[] = definitions
    .filter(
      (definition) =>
        (definition.when?.(context) ?? true) &&
        (definition.minHorizon === undefined || horizonDays >= definition.minHorizon),
    )
    // Délais ajustés selon les réponses (ex. tenues sur mesure).
    .map((base) => ({ ...base, ...base.adjust?.(context) }))
    .map((definition, index) => {
      let raw = Math.round(
        definition.floor + (definition.ideal - definition.floor) * compression,
      );
      if (definition.asap && horizonDays - ASAP_DELAY > raw) {
        raw = horizonDays - ASAP_DELAY;
      }
      return { definition, index, raw, queued: raw > earliest, daysBefore: raw };
    });

  // File des tâches à lancer tout de suite : les plus critiques d'abord.
  drafts
    .filter((draft) => draft.queued)
    .sort(
      (a, b) =>
        a.definition.priority - b.definition.priority ||
        b.definition.ideal - a.definition.ideal ||
        a.index - b.index,
    )
    .forEach((draft, position) => {
      draft.daysBefore = Math.max(1, earliest - Math.floor(position / QUEUE_TASKS_PER_DAY));
    });

  // Dépendances : les parentes précèdent leurs dépendantes dans le catalogue.
  const gap = Math.max(MIN_DEPENDENCY_GAP, Math.round(DEPENDENCY_GAP * compression));
  const byKey = new Map<string, Draft>();
  for (const draft of drafts) {
    const parent = draft.definition.dependsOn
      ? byKey.get(draft.definition.dependsOn)
      : undefined;
    if (parent) {
      draft.daysBefore = Math.max(
        1,
        Math.min(draft.daysBefore, parent.daysBefore - gap),
      );
    }
    byKey.set(draft.definition.key, draft);
  }

  // Plus de jours avant le mariage = échéance plus tôt.
  const tasks = [...drafts]
    .sort(
      (a, b) =>
        b.daysBefore - a.daysBefore ||
        a.definition.priority - b.definition.priority ||
        a.index - b.index,
    )
    .map((draft): ScheduledTask => {
      const { definition, daysBefore } = draft;
      const dependsOn =
        definition.dependsOn && byKey.has(definition.dependsOn)
          ? (definition.dependsOn as PlanningTaskKey)
          : null;
      return {
        key: definition.key as PlanningTaskKey,
        category: definition.category,
        priority: definition.priority,
        dependsOn,
        href: definition.href ?? null,
        daysBefore,
        targetOffsetDays: -daysBefore,
        dueDate: addDaysToIsoDate(weddingDate, -daysBefore),
        pace: paceOf(draft, earliest),
      };
    });

  return { horizonDays, compression, tasks };
}

function paceOf({ definition, daysBefore, queued }: Draft, earliest: number): TaskPace {
  if (definition.floor > earliest || daysBefore < definition.floor) return "urgent";
  // Couvre aussi idéal = plancher (ex. la veille du mariage).
  if (definition.ideal - daysBefore < TIGHT_MIN_LOSS) return "comfortable";
  const slack = (daysBefore - definition.floor) / (definition.ideal - definition.floor);
  return queued || slack < TIGHT_SLACK ? "tight" : "comfortable";
}

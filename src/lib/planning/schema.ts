import { z } from "zod";

/*
 * Rétroplanning sur mesure : réponses du questionnaire d'accompagnement et
 * types du planning calculé (cf. catalog.ts et schedule.ts).
 */

export const MUSIC_CHOICES = ["dj", "band", "playlist", "none"] as const;
export type MusicChoice = (typeof MUSIC_CHOICES)[number];

/** Tenues : le sur-mesure demande plusieurs mois de plus. */
export const ATTIRE_CHOICES = ["custom", "ready", "undecided"] as const;
export type AttireChoice = (typeof ATTIRE_CHOICES)[number];

export const STATIONERY_CHOICES = ["paper", "online", "both"] as const;
export type StationeryChoice = (typeof STATIONERY_CHOICES)[number];

/** Traditions facultatives : chacune ajoute ses étapes au rétroplanning. */
export const TRADITIONS = [
  "save_the_date",
  "registry",
  "guest_gifts",
  "favors",
  "bachelor",
  "rehearsal",
  "speeches",
  "first_dance",
  "wedding_night",
  "partner_gifts",
] as const;
export type Tradition = (typeof TRADITIONS)[number];

/** Étapes que le couple a déjà réglées : leurs tâches sont créées cochées. */
export const DONE_OPTIONS = [
  "budget",
  "guest_list",
  "venue",
  "town_hall",
  "catering",
  "photographer",
  "music",
  "attire",
  "rings",
] as const;
export type DoneOption = (typeof DONE_OPTIONS)[number];

/**
 * Réponses du questionnaire, qui activent ou retirent des tâches du catalogue.
 * Les champs ajoutés après la première version ont une valeur par défaut :
 * des réponses déjà enregistrées restent lisibles.
 */
export const planningAnswersSchema = z.object({
  religiousCeremony: z.boolean(),
  secularCeremony: z.boolean(),
  cateringByVenue: z.boolean(),
  music: z.enum(MUSIC_CHOICES),
  photographer: z.boolean().default(true),
  videographer: z.boolean(),
  attire: z.enum(ATTIRE_CHOICES).default("undecided"),
  weddingParty: z.boolean().default(false),
  stationery: z.enum(STATIONERY_CHOICES).default("both"),
  traditions: z.array(z.enum(TRADITIONS)).default(() => [...DEFAULT_TRADITIONS]),
  guestAccommodation: z.boolean(),
  honeymoon: z.boolean(),
  marriageContract: z.boolean(),
  alreadyDone: z.array(z.enum(DONE_OPTIONS)).default(() => []),
});
export type PlanningAnswers = z.output<typeof planningAnswersSchema>;
export type PlanningAnswersInput = z.input<typeof planningAnswersSchema>;

const DEFAULT_TRADITIONS: readonly Tradition[] = [
  "save_the_date",
  "registry",
  "guest_gifts",
  "bachelor",
  "speeches",
  "first_dance",
];

/** Réponses supposées tant que le couple n'a pas rempli le questionnaire. */
export const DEFAULT_PLANNING_ANSWERS: PlanningAnswers = {
  religiousCeremony: false,
  secularCeremony: false,
  cateringByVenue: false,
  music: "dj",
  photographer: true,
  videographer: false,
  attire: "undecided",
  weddingParty: false,
  stationery: "both",
  traditions: [...DEFAULT_TRADITIONS],
  guestAccommodation: false,
  honeymoon: true,
  marriageContract: false,
  alreadyDone: [],
};

export const TASK_CATEGORIES = [
  "foundations",
  "vendors",
  "attire",
  "guests",
  "admin",
  "final",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/**
 * Rythme d'une tâche une fois planifiée :
 * - comfortable : marge confortable ;
 * - tight : délai compressé, ou tâche à lancer dès les premiers jours ;
 * - urgent : même le délai plancher n'est plus tenable.
 */
export const TASK_PACES = ["comfortable", "tight", "urgent"] as const;
export type TaskPace = (typeof TASK_PACES)[number];

/** Contexte du mariage nécessaire au calcul. */
export type PlanningContext = {
  answers: PlanningAnswers;
  /** Code pays ISO (weddings.country_code) ; les tâches administratives sont propres à la France. */
  countryCode: string | null;
  /** Jours restants avant le mariage. */
  horizonDays: number;
};

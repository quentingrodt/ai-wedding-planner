import type { PlanningContext, TaskCategory, Tradition } from "./schema";

/*
 * Catalogue des tâches classiques d'un mariage (marché FR), du « 12 mois
 * avant » à la veille.
 *
 * Délais exprimés en jours avant le mariage :
 * - ideal : échéance confortable dans un planning de 12 mois ;
 * - floor : échéance la plus tardive encore réaliste (ex. faire-part à J-42).
 * Le calcul (schedule.ts) interpole entre les deux selon le temps restant.
 *
 * Les tâches parentes (dependsOn) précèdent toujours leurs dépendantes dans
 * la liste : le calcul s'appuie sur cet ordre.
 */

/** Pages de l'app vers lesquelles une tâche peut renvoyer. */
export type PlanningHref =
  | "/budget"
  | "/guests"
  | "/invitations"
  | "/registry"
  | "/venues"
  | "/accommodation"
  | "/seating"
  | "/itinerary"
  | "/playlist"
  | "/inspiration";

export type TaskDefinition = {
  key: string;
  category: TaskCategory;
  ideal: number;
  floor: number;
  /** 1 : critique, 2 : importante, 3 : confort. Ordonne la file des tâches à lancer tout de suite. */
  priority: 1 | 2 | 3;
  /** À lancer dès que possible quel que soit l'horizon (ex. le lieu fixe la date). */
  asap?: boolean;
  /** Horizon minimal (jours) en dessous duquel la tâche n'a plus de sens. */
  minHorizon?: number;
  dependsOn?: string;
  /** Page de l'app où réaliser la tâche. */
  href?: PlanningHref;
  when?: (context: PlanningContext) => boolean;
  /** Délais ajustés selon les réponses (ex. tenues sur mesure). */
  adjust?: (context: PlanningContext) => { ideal: number; floor: number } | null;
};

const inFrance = ({ countryCode }: PlanningContext) =>
  countryCode === null || countryCode === "FR";
const withTradition =
  (tradition: Tradition) =>
  ({ answers }: PlanningContext) =>
    answers.traditions.includes(tradition);
const hasCeremonyOfficiant = ({ answers }: PlanningContext) =>
  answers.religiousCeremony || answers.secularCeremony;
const customAttire = (ideal: number, floor: number) => ({ answers }: PlanningContext) =>
  answers.attire === "custom" ? { ideal, floor } : null;

export const TASK_CATALOG = [
  // — Fondations —
  { key: "set_budget", category: "foundations", ideal: 365, floor: 75, priority: 1, asap: true, href: "/budget" },
  { key: "guest_list", category: "foundations", ideal: 350, floor: 75, priority: 1, asap: true, href: "/guests" },
  {
    key: "explore_venues", category: "foundations", ideal: 365, floor: 75, priority: 1, asap: true, href: "/venues",
  },
  {
    key: "book_venue", category: "foundations", ideal: 330, floor: 60, priority: 1, asap: true,
    dependsOn: "explore_venues", href: "/venues",
  },
  {
    key: "book_town_hall", category: "foundations", ideal: 330, floor: 60, priority: 1, asap: true,
    when: inFrance,
  },
  { key: "choose_witnesses", category: "foundations", ideal: 340, floor: 45, priority: 2 },
  { key: "announce_date", category: "foundations", ideal: 340, floor: 60, priority: 3 },
  { key: "gather_inspiration", category: "foundations", ideal: 360, floor: 60, priority: 3, href: "/inspiration" },
  { key: "book_officiant", category: "foundations", ideal: 330, floor: 60, priority: 2, when: hasCeremonyOfficiant },
  {
    key: "book_accommodation", category: "foundations", ideal: 300, floor: 45, priority: 3,
    dependsOn: "book_venue", href: "/accommodation",
    when: ({ answers }) => answers.guestAccommodation,
  },
  { key: "assign_roles", category: "foundations", ideal: 120, floor: 14, priority: 2 },

  // — Prestataires —
  {
    key: "book_catering", category: "vendors", ideal: 270, floor: 45, priority: 1,
    dependsOn: "book_venue",
    when: ({ answers }) => !answers.cateringByVenue,
  },
  {
    key: "book_photographer", category: "vendors", ideal: 270, floor: 45, priority: 1,
    when: ({ answers }) => answers.photographer,
  },
  {
    key: "book_videographer", category: "vendors", ideal: 270, floor: 45, priority: 2,
    when: ({ answers }) => answers.videographer,
  },
  {
    key: "book_dj", category: "vendors", ideal: 255, floor: 45, priority: 2,
    dependsOn: "book_venue",
    when: ({ answers }) => answers.music === "dj" || answers.music === "band",
  },
  { key: "book_florist", category: "vendors", ideal: 255, floor: 30, priority: 2 },
  { key: "book_transport", category: "vendors", ideal: 255, floor: 21, priority: 3 },
  { key: "book_other_vendors", category: "vendors", ideal: 240, floor: 30, priority: 3 },
  { key: "cake_tasting", category: "vendors", ideal: 255, floor: 30, priority: 3 },
  { key: "book_cake", category: "vendors", ideal: 210, floor: 21, priority: 3, dependsOn: "cake_tasting" },
  { key: "book_beauty", category: "vendors", ideal: 210, floor: 30, priority: 2 },
  { key: "rent_equipment", category: "vendors", ideal: 180, floor: 30, priority: 3, dependsOn: "book_venue" },
  { key: "taste_menu", category: "vendors", ideal: 150, floor: 30, priority: 2, dependsOn: "book_catering" },
  { key: "confirm_menu", category: "vendors", ideal: 140, floor: 21, priority: 2, dependsOn: "taste_menu" },
  { key: "decor_items", category: "vendors", ideal: 120, floor: 14, priority: 3 },

  // — Tenues & beauté —
  { key: "attire_style", category: "attire", ideal: 315, floor: 75, priority: 2, adjust: customAttire(365, 180) },
  {
    key: "choose_attire", category: "attire", ideal: 270, floor: 60, priority: 1,
    dependsOn: "attire_style", adjust: customAttire(330, 150),
  },
  {
    key: "order_attire", category: "attire", ideal: 210, floor: 45, priority: 1,
    dependsOn: "choose_attire", adjust: customAttire(270, 120),
  },
  {
    key: "party_attire", category: "attire", ideal: 255, floor: 45, priority: 3,
    when: ({ answers }) => answers.weddingParty,
  },
  { key: "choose_rings", category: "attire", ideal: 180, floor: 21, priority: 2 },
  { key: "attire_fittings", category: "attire", ideal: 90, floor: 14, priority: 2, dependsOn: "order_attire" },
  { key: "beauty_trials", category: "attire", ideal: 90, floor: 14, priority: 3, dependsOn: "book_beauty" },
  { key: "beauty_care", category: "attire", ideal: 90, floor: 10, priority: 3 },
  { key: "final_fitting", category: "attire", ideal: 30, floor: 5, priority: 2, dependsOn: "attire_fittings" },
  { key: "pickup_attire", category: "attire", ideal: 7, floor: 2, priority: 1, dependsOn: "final_fitting" },

  // — Invités, papeterie & festivités —
  {
    key: "save_the_date", category: "guests", ideal: 300, floor: 120, priority: 3, minHorizon: 150,
    when: withTradition("save_the_date"),
  },
  {
    key: "wedding_website", category: "guests", ideal: 300, floor: 60, priority: 3, href: "/invitations",
    when: ({ answers }) => answers.stationery !== "paper",
  },
  {
    key: "wedding_registry", category: "guests", ideal: 180, floor: 45, priority: 3,
    when: withTradition("registry"), href: "/registry",
  },
  { key: "guest_gifts", category: "guests", ideal: 150, floor: 21, priority: 3, when: withTradition("guest_gifts") },
  { key: "order_favors", category: "guests", ideal: 150, floor: 21, priority: 3, when: withTradition("favors") },
  {
    key: "design_invitations", category: "guests", ideal: 130, floor: 50, priority: 2,
    dependsOn: "book_venue", href: "/invitations",
  },
  {
    key: "send_invitations", category: "guests", ideal: 120, floor: 42, priority: 1,
    dependsOn: "design_invitations", href: "/invitations",
  },
  { key: "bachelor_parties", category: "guests", ideal: 120, floor: 30, priority: 3, when: withTradition("bachelor") },
  { key: "buy_guest_gifts", category: "guests", ideal: 110, floor: 14, priority: 3, dependsOn: "guest_gifts" },
  { key: "rehearsal_dinner", category: "guests", ideal: 150, floor: 14, priority: 3, when: withTradition("rehearsal") },
  { key: "small_items", category: "guests", ideal: 90, floor: 7, priority: 3 },
  { key: "rsvp_follow_up", category: "guests", ideal: 45, floor: 21, priority: 2, dependsOn: "send_invitations", href: "/guests" },
  { key: "dietary_needs", category: "guests", ideal: 30, floor: 10, priority: 2, dependsOn: "rsvp_follow_up", href: "/guests" },
  { key: "seating_plan", category: "guests", ideal: 30, floor: 7, priority: 1, dependsOn: "rsvp_follow_up", href: "/seating" },
  { key: "table_stationery", category: "guests", ideal: 21, floor: 5, priority: 3, dependsOn: "seating_plan" },

  // — Cérémonie & démarches —
  {
    key: "religious_preparation", category: "admin", ideal: 240, floor: 60, priority: 2,
    when: ({ answers }) => answers.religiousCeremony,
  },
  { key: "finalize_ceremony", category: "admin", ideal: 180, floor: 30, priority: 2 },
  {
    key: "marriage_contract", category: "admin", ideal: 150, floor: 45, priority: 2,
    when: (context) => context.answers.marriageContract && inFrance(context),
  },
  // Actes de naissance : moins de 3 mois au dépôt du dossier.
  { key: "birth_certificates", category: "admin", ideal: 100, floor: 40, priority: 1, when: inFrance },
  {
    key: "town_hall_file", category: "admin", ideal: 75, floor: 30, priority: 1,
    dependsOn: "birth_certificates", when: inFrance,
  },
  {
    key: "ceremony_readings", category: "admin", ideal: 60, floor: 10, priority: 3,
    dependsOn: "finalize_ceremony", when: hasCeremonyOfficiant,
  },
  { key: "wedding_vows", category: "admin", ideal: 60, floor: 7, priority: 2 },
  { key: "speeches", category: "admin", ideal: 60, floor: 7, priority: 3, when: withTradition("speeches") },
  // Les bans sont affichés 10 jours avant la cérémonie.
  {
    key: "bans_publication", category: "admin", ideal: 25, floor: 11, priority: 1,
    dependsOn: "town_hall_file", when: inFrance,
  },

  // — Jour J & derniers préparatifs —
  {
    key: "plan_honeymoon", category: "final", ideal: 315, floor: 60, priority: 3,
    when: ({ answers }) => answers.honeymoon,
  },
  {
    key: "book_honeymoon", category: "final", ideal: 180, floor: 30, priority: 3,
    dependsOn: "plan_honeymoon",
    when: ({ answers }) => answers.honeymoon,
  },
  { key: "wedding_night", category: "final", ideal: 180, floor: 14, priority: 3, when: withTradition("wedding_night") },
  { key: "dance_lessons", category: "final", ideal: 180, floor: 30, priority: 3, when: withTradition("first_dance") },
  {
    key: "playlist", category: "final", ideal: 90, floor: 10, priority: 3, href: "/playlist",
    when: ({ answers }) => answers.music !== "none",
  },
  { key: "partner_gifts", category: "final", ideal: 90, floor: 5, priority: 3, when: withTradition("partner_gifts") },
  { key: "honeymoon_packing", category: "final", ideal: 60, floor: 7, priority: 3, dependsOn: "book_honeymoon" },
  {
    key: "shot_list", category: "final", ideal: 45, floor: 7, priority: 3,
    dependsOn: "book_photographer",
    when: ({ answers }) => answers.photographer,
  },
  { key: "day_of_program", category: "final", ideal: 30, floor: 7, priority: 2, href: "/itinerary" },
  { key: "final_headcount", category: "final", ideal: 30, floor: 7, priority: 1, dependsOn: "rsvp_follow_up" },
  { key: "confirm_transport", category: "final", ideal: 30, floor: 5, priority: 3, dependsOn: "book_transport" },
  { key: "confirm_vendors", category: "final", ideal: 14, floor: 5, priority: 2 },
  { key: "vendor_contacts", category: "final", ideal: 7, floor: 2, priority: 3 },
  { key: "decor_check", category: "final", ideal: 7, floor: 2, priority: 3 },
  { key: "emergency_kit", category: "final", ideal: 7, floor: 1, priority: 3 },
  { key: "thank_you_words", category: "final", ideal: 7, floor: 1, priority: 3 },
  {
    key: "travel_prep", category: "final", ideal: 7, floor: 1, priority: 3,
    dependsOn: "honeymoon_packing",
    when: ({ answers }) => answers.honeymoon,
  },
  { key: "weather_check", category: "final", ideal: 5, floor: 1, priority: 3 },
  { key: "vendor_payments", category: "final", ideal: 3, floor: 1, priority: 2, href: "/budget" },
  { key: "review_schedule", category: "final", ideal: 2, floor: 1, priority: 2, dependsOn: "day_of_program" },
  { key: "eve_evening", category: "final", ideal: 1, floor: 1, priority: 3 },
] as const satisfies readonly TaskDefinition[];

export type PlanningTaskKey = (typeof TASK_CATALOG)[number]["key"];

export const PLANNING_TASK_KEYS: readonly PlanningTaskKey[] = TASK_CATALOG.map(
  (task) => task.key,
);

/** Tâches cochées d'office pour chaque étape déclarée « déjà réglée ». */
export const DONE_OPTION_TASKS = {
  budget: ["set_budget"],
  guest_list: ["guest_list"],
  venue: ["explore_venues", "book_venue"],
  town_hall: ["book_town_hall"],
  catering: ["book_catering"],
  photographer: ["book_photographer"],
  music: ["book_dj"],
  attire: ["attire_style", "choose_attire"],
  rings: ["choose_rings"],
} as const satisfies Record<string, readonly PlanningTaskKey[]>;

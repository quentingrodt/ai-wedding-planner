import { z } from "zod";

/**
 * Catalogue du « swipe d'inspiration » : chaque étape propose des choix que le
 * couple aime ou écarte. Les réponses composent le Style DNA du mariage et
 * alimenteront le rétroplanning et le budget.
 *
 * Les 3 premières étapes se jouent dans Date Night (sans compte) ; les autres
 * complètent le carnet d'inspiration, après l'inscription. L'ordre des
 * clés est l'ordre du parcours, section par section.
 */
export const INSPIRATION_OPTIONS = {
  // Ensemble
  venue: ["chateau", "countryside", "beach", "urban"],
  ceremony: ["secular", "religious", "civil"],
  reception: ["seated", "family", "cocktail", "foodTrucks"],
  dessert: ["croquembouche", "tieredCake", "dessertBar", "nakedCake"],
  transport: ["luxury", "vintage", "carriage", "shuttle"],
  honeymoon: ["island", "roadTrip", "cityBreak", "safari"],
  // Pour elle
  brideAttire: ["princess", "sheath", "boho", "pantsuit"],
  bridesmaids: ["matching", "mixMatch", "pastel", "freeStyle"],
  bacheloretteParty: ["spa", "cityTrip", "workshop", "poolParty"],
  // Pour lui
  groomAttire: ["threePiece", "tuxedo", "linen", "velvet"],
  groomsmen: ["matching", "suspenders", "linen", "accessory"],
  bachelorParty: ["adventure", "karting", "cityTrip", "tasting"],
} as const;

export type InspirationStep = keyof typeof INSPIRATION_OPTIONS;

/** Étapes du carnet, dans l'ordre du parcours. */
export const INSPIRATION_STEPS = Object.keys(INSPIRATION_OPTIONS) as readonly InspirationStep[];
export type InspirationOption<S extends InspirationStep = InspirationStep> =
  (typeof INSPIRATION_OPTIONS)[S][number];

/** Sections du carnet, et leurs étapes dans l'ordre. */
export const INSPIRATION_SECTIONS = [
  { key: "together", steps: ["venue", "ceremony", "reception", "dessert", "transport", "honeymoon"] },
  { key: "her", steps: ["brideAttire", "bridesmaids", "bacheloretteParty"] },
  { key: "him", steps: ["groomAttire", "groomsmen", "bachelorParty"] },
] as const satisfies readonly { key: string; steps: readonly InspirationStep[] }[];
export type InspirationSection = (typeof INSPIRATION_SECTIONS)[number]["key"];

/** Étapes jouées dans le tunnel Date Night, dans l'ordre. */
export const DATE_NIGHT_STEPS = ["venue", "ceremony", "reception"] as const;
export type DateNightStep = (typeof DATE_NIGHT_STEPS)[number];

const likesOf = <T extends readonly [string, ...string[]]>(options: T) =>
  z.array(z.enum(options)).max(options.length).optional();

/** Choix aimés par étape ; une étape absente n'a pas encore été jouée. */
export const inspirationLikesSchema = z.object({
  venue: likesOf(INSPIRATION_OPTIONS.venue),
  ceremony: likesOf(INSPIRATION_OPTIONS.ceremony),
  reception: likesOf(INSPIRATION_OPTIONS.reception),
  dessert: likesOf(INSPIRATION_OPTIONS.dessert),
  brideAttire: likesOf(INSPIRATION_OPTIONS.brideAttire),
  groomAttire: likesOf(INSPIRATION_OPTIONS.groomAttire),
  bridesmaids: likesOf(INSPIRATION_OPTIONS.bridesmaids),
  groomsmen: likesOf(INSPIRATION_OPTIONS.groomsmen),
  bacheloretteParty: likesOf(INSPIRATION_OPTIONS.bacheloretteParty),
  bachelorParty: likesOf(INSPIRATION_OPTIONS.bachelorParty),
  transport: likesOf(INSPIRATION_OPTIONS.transport),
  honeymoon: likesOf(INSPIRATION_OPTIONS.honeymoon),
});
export type InspirationLikes = z.infer<typeof inspirationLikesSchema>;

/** Réponses du tunnel Date Night. */
export type DateNightLikes = Pick<InspirationLikes, DateNightStep>;

export function isInspirationOption<S extends InspirationStep>(
  step: S,
  value: string,
): value is InspirationOption<S> {
  return (INSPIRATION_OPTIONS[step] as readonly string[]).includes(value);
}

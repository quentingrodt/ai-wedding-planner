import { addDaysToIsoDate } from "@/lib/weddings/dates";

/*
 * Outils des carnets de prestataires : tout est calculé ici, à partir du
 * nombre d'invités, de la date et des choix des mariés. Libellés traduits
 * côté UI (Vendors.tools.*).
 */

// — Boissons —

/** Repères de consommation pour une soirée de mariage. */
export const DRINKS = [
  { key: "champagne", unit: "bottles", guestsPerUnit: [3, 4] },
  { key: "white", unit: "bottles", guestsPerUnit: [3, 4] },
  { key: "red", unit: "bottles", guestsPerUnit: [2, 2] },
  { key: "beer", unit: "units", unitsPerGuest: 4 },
  { key: "cocktails", unit: "bottles", cocktailsPerBottle: 14 },
  { key: "water", unit: "litres", unitsPerGuest: 1 },
  { key: "soft", unit: "litres", guestsPerUnit: [4, 4] },
] as const;
export type DrinkKey = (typeof DRINKS)[number]["key"];
export const DRINK_KEYS = DRINKS.map((drink) => drink.key) as readonly DrinkKey[];

/** Cocktails servis par invité quand le bar à cocktails est ouvert. */
export const COCKTAILS_PER_GUEST = 2;

/** Quantité à prévoir : une fourchette (min, max) pour les repères « 3 ou 4 personnes ». */
export function drinkQuantity(key: DrinkKey, guests: number): { min: number; max: number } {
  const drink = DRINKS.find((candidate) => candidate.key === key);
  if (!drink || guests <= 0) return { min: 0, max: 0 };
  if ("guestsPerUnit" in drink) {
    const [low, high] = drink.guestsPerUnit;
    return { min: Math.ceil(guests / high), max: Math.ceil(guests / low) };
  }
  if ("unitsPerGuest" in drink) {
    const units = guests * drink.unitsPerGuest;
    return { min: units, max: units };
  }
  const bottles = Math.ceil((guests * COCKTAILS_PER_GUEST) / drink.cocktailsPerBottle);
  return { min: bottles, max: bottles };
}

/** Idées de stands et de bars pour le repas ou le vin d'honneur. */
export const STATION_IDEAS = [
  "liveCooking",
  "tapas",
  "salads",
  "grill",
  "seafood",
  "cheese",
  "soups",
  "pasta",
  "desserts",
  "worldFood",
] as const;

export const MENU_COURSES = ["starter", "main", "cheese", "dessert", "drinks"] as const;
export const COCKTAIL_PARTS = ["savory", "sweet", "drinks"] as const;

// — Pièce montée —

/** Étages et portions selon le diamètre (ou le côté) du gâteau. */
export const CAKE_TIERS = [
  { size: 15, round: 14, square: 18 },
  { size: 20, round: 24, square: 32 },
  { size: 23, round: 32, square: 36 },
  { size: 25, round: 40, square: 50 },
  { size: 30, round: 56, square: 72 },
  { size: 35, round: 74, square: 98 },
] as const;
export type CakeShape = "round" | "square";
export type CakeSize = (typeof CAKE_TIERS)[number]["size"];
export const CAKE_SIZES = CAKE_TIERS.map((tier) => tier.size) as readonly CakeSize[];

export function cakePortions(sizes: readonly number[], shape: CakeShape): number {
  return CAKE_TIERS.filter((tier) => sizes.includes(tier.size)).reduce((sum, tier) => sum + tier[shape], 0);
}

/**
 * Étages suggérés : on part du plus petit et on ajoute des étages plus
 * larges jusqu'à servir tous les invités (six étages au plus).
 */
export function suggestCakeTiers(guests: number, shape: CakeShape): CakeSize[] {
  if (guests <= 0) return [];
  const sizes: CakeSize[] = [];
  for (const tier of CAKE_TIERS) {
    sizes.push(tier.size);
    if (cakePortions(sizes, shape) >= guests) return sizes;
  }
  return sizes;
}

// — Préparatifs coiffure et maquillage —

export type ReadyPerson = { name: string; hair: boolean; makeup: boolean };
export type ReadySlot = { name: string; start: string; end: string };

/** Marge entre la fin des préparatifs et l'heure où l'on doit être prête (habillage, photos). */
export const READY_MARGIN_MINUTES = 45;

const toMinutes = (time: string) => Number.parseInt(time.slice(0, 2), 10) * 60 + Number.parseInt(time.slice(3, 5), 10);
const toTime = (minutes: number) => {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

/**
 * Planning du matin : coiffure et maquillage s'enchaînent chacun de leur
 * côté, la mariée (première personne de la liste) passe en dernier pour être
 * la plus fraîche, et tout se termine READY_MARGIN_MINUTES avant l'heure dite.
 */
export function gettingReadySchedule(
  people: readonly ReadyPerson[],
  readyBy: string,
  minutes: { hair: number; makeup: number },
): { hair: ReadySlot[]; makeup: ReadySlot[]; start: string | null } {
  const end = toMinutes(readyBy) - READY_MARGIN_MINUTES;
  const order = [...people.slice(1), ...people.slice(0, 1)];
  const lane = (service: "hair" | "makeup") => {
    const queue = order.filter((person) => person[service]);
    const duration = minutes[service];
    const first = end - queue.length * duration;
    return queue.map((person, index) => ({
      name: person.name,
      start: toTime(first + index * duration),
      end: toTime(first + (index + 1) * duration),
    }));
  };
  const hair = lane("hair");
  const makeup = lane("makeup");
  const starts = [hair[0]?.start, makeup[0]?.start].filter((value): value is string => value !== undefined);
  return { hair, makeup, start: starts.length > 0 ? starts.sort()[0] : null };
}

// — Papeterie —

export const STATIONERY_ITEMS = [
  "bachelorInvites",
  "engagementInvites",
  "saveTheDate",
  "invitations",
  "ceremonyPrograms",
  "welcomeSign",
  "tableNumbers",
  "placeCards",
  "menus",
  "seatingChart",
  "guestbook",
  "favorWrapping",
  "thankYouCards",
] as const;
export type StationeryItem = (typeof STATIONERY_ITEMS)[number];

/** Quantité conseillée : un faire-part par foyer, un marque-place par invité… */
export function suggestedQuantity(
  item: StationeryItem,
  context: { households: number; guests: number; tables: number },
): number | null {
  switch (item) {
    case "saveTheDate":
    case "invitations":
    case "thankYouCards":
      return context.households || null;
    case "placeCards":
    case "menus":
    case "favorWrapping":
      return context.guests || null;
    case "tableNumbers":
      return context.tables || null;
    case "welcomeSign":
    case "seatingChart":
    case "guestbook":
      return 1;
    default:
      return null;
  }
}

// — Site du mariage —

export const WEBSITE_ELEMENTS = [
  "home",
  "essentials",
  "rsvp",
  "practical",
  "gallery",
  "registry",
  "contacts",
  "thanks",
] as const;
export type WebsiteElement = (typeof WEBSITE_ELEMENTS)[number];

/** Ce que Céleste offre déjà aux invités sur leur lien personnel. */
export function websiteCoveredByCeleste(context: {
  hasGuests: boolean;
  hasRegistry: boolean;
  sharesLodging: boolean;
  hasDate: boolean;
}): Set<WebsiteElement> {
  const covered = new Set<WebsiteElement>();
  if (context.hasGuests) covered.add("rsvp");
  if (context.hasRegistry) covered.add("registry");
  if (context.sharesLodging) covered.add("practical");
  if (context.hasGuests && context.hasDate) covered.add("essentials");
  return covered;
}

// — Cadeaux des invités —

export const GIFT_IDEAS = [
  "sweets",
  "jams",
  "oils",
  "candles",
  "seeds",
  "coasters",
  "cards",
  "soaps",
  "coffeeTea",
  "lavender",
] as const;

// — Voyage de noces —

/** Destinations et mois idéaux (1 = janvier). */
export const HONEYMOON_DESTINATIONS = [
  { key: "maldives", months: [11, 12, 1, 2, 3, 4] },
  { key: "santorini", months: [5, 6, 7, 8, 9] },
  { key: "boraBora", months: [5, 6, 7, 8, 9, 10] },
  { key: "kyoto", months: [4, 11] },
  { key: "florence", months: [5, 6, 7, 9] },
  { key: "bali", months: [5, 6, 9] },
  { key: "philippines", months: [1, 2, 3, 4] },
] as const;
export type HoneymoonDestination = (typeof HONEYMOON_DESTINATIONS)[number]["key"];

/** Mois du départ : le lendemain du mariage, ou aujourd'hui sans date. */
export function departureMonth(weddingDate: string | null, today: string): number {
  const date = weddingDate ? addDaysToIsoDate(weddingDate, 1) : today;
  return Number.parseInt(date.slice(5, 7), 10);
}

/** Destinations idéales pour un mois de départ, dans l'ordre du guide. */
export function destinationsFor(month: number): HoneymoonDestination[] {
  return HONEYMOON_DESTINATIONS.filter((destination) => (destination.months as readonly number[]).includes(month)).map(
    (destination) => destination.key,
  );
}

// — Robe de mariée —

export const GOWN_GUIDE = ["mermaid", "ballgown", "empire", "sheath", "strapless"] as const;

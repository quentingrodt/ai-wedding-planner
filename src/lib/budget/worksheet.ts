import type { BudgetCategory } from "./schema";

/*
 * Grille de budget : rubriques et postes pré-remplis, à compléter par le
 * couple (budget, coût, notes, qui paie). Chaque poste garde une catégorie
 * budgétaire (jauge du tableau de bord, devis) et un payeur selon la
 * tradition française, modifiable.
 *
 * Libellés : Budget.worksheet.sections.<section> et Budget.worksheet.lines.<line>.
 */

/** Qui finance un poste ; libellés dans Budget.payers.<payer>. */
export const BUDGET_PAYERS = [
  "couple",
  "brideFamily",
  "groomFamily",
  "shared",
  "witnesses",
] as const;
export type BudgetPayer = (typeof BUDGET_PAYERS)[number];

type LineDefinition = {
  key: string;
  category: BudgetCategory;
  /** Payeur selon la tradition. */
  tradition: BudgetPayer;
};

// Générique : la clé garde son type littéral (BudgetLineKey, clés de traduction).
const line = <K extends string>(key: K, category: BudgetCategory, tradition: BudgetPayer) => ({
  key,
  category,
  tradition,
});

export const BUDGET_SECTIONS = [
  {
    key: "ceremonyReception",
    lines: [
      line("venueRental", "venue", "shared"),
      line("tentRental", "venue", "shared"),
      line("ceremonyDecor", "decoration", "shared"),
      line("receptionDecor", "decoration", "shared"),
      line("confetti", "decoration", "couple"),
      line("officiant", "officiant", "couple"),
      line("churchFees", "officiant", "groomFamily"),
      line("marriageContract", "other", "couple"),
    ],
  },
  {
    key: "food",
    lines: [
      line("dinnerCatering", "catering", "shared"),
      line("cocktail", "catering", "brideFamily"),
      line("drinks", "catering", "brideFamily"),
      line("water", "catering", "shared"),
      line("weddingCake", "cake", "shared"),
      line("lateSnacks", "catering", "shared"),
    ],
  },
  {
    key: "attire",
    lines: [
      line("weddingDress", "attire", "brideFamily"),
      line("dressAlterations", "attire", "brideFamily"),
      line("veil", "attire", "brideFamily"),
      line("brideShoes", "attire", "brideFamily"),
      line("lingerie", "attire", "brideFamily"),
      line("garter", "attire", "brideFamily"),
      line("jewelry", "attire", "brideFamily"),
      line("groomSuit", "attire", "groomFamily"),
      line("groomShoes", "attire", "groomFamily"),
      line("groomAccessories", "attire", "groomFamily"),
      line("bridesmaidsDresses", "attire", "couple"),
      line("groomsmenSuits", "attire", "couple"),
      line("kidsOutfits", "attire", "couple"),
    ],
  },
  {
    key: "beauty",
    lines: [
      line("hair", "beauty", "brideFamily"),
      line("makeup", "beauty", "brideFamily"),
      line("hairTrial", "beauty", "brideFamily"),
      line("makeupTrial", "beauty", "brideFamily"),
    ],
  },
  {
    key: "rings",
    lines: [line("groomRing", "rings", "brideFamily"), line("brideRing", "rings", "groomFamily")],
  },
  {
    key: "flowers",
    lines: [
      line("brideBouquet", "decoration", "brideFamily"),
      line("boutonnieres", "decoration", "brideFamily"),
      line("bridesmaidsBouquets", "decoration", "brideFamily"),
      line("centerpieces", "decoration", "groomFamily"),
      line("floralDecor", "decoration", "groomFamily"),
      line("tableDecor", "decoration", "groomFamily"),
    ],
  },
  {
    key: "photoVideo",
    lines: [
      line("photographer", "photography", "brideFamily"),
      line("videographer", "photography", "brideFamily"),
      line("album", "photography", "brideFamily"),
    ],
  },
  {
    key: "entertainment",
    lines: [
      line("dj", "music", "brideFamily"),
      line("liveBand", "music", "brideFamily"),
      line("musicians", "music", "brideFamily"),
      line("magician", "music", "brideFamily"),
      line("soundSystem", "music", "shared"),
      line("lighting", "decoration", "shared"),
      line("danceFloor", "venue", "shared"),
      line("partyFavors", "decoration", "shared"),
    ],
  },
  {
    key: "stationery",
    lines: [
      line("invitations", "stationery", "shared"),
      line("thankYouCards", "stationery", "shared"),
      line("menus", "stationery", "shared"),
      line("programs", "stationery", "shared"),
      line("placeCards", "stationery", "shared"),
      line("tableCards", "stationery", "shared"),
      line("welcomeSigns", "stationery", "shared"),
      line("favorBoxes", "stationery", "shared"),
      line("giftTags", "stationery", "shared"),
      line("engagementInvitations", "stationery", "shared"),
      line("partyInvitations", "stationery", "witnesses"),
    ],
  },
  {
    key: "gifts",
    lines: [
      line("favors", "other", "couple"),
      line("parentsGifts", "other", "couple"),
      line("brideWitnessGifts", "other", "couple"),
      line("groomWitnessGifts", "other", "couple"),
      line("kidsGifts", "other", "couple"),
    ],
  },
  {
    key: "transport",
    lines: [
      line("coupleCar", "transport", "groomFamily"),
      line("carDecor", "transport", "couple"),
      line("chauffeur", "transport", "couple"),
      line("guestShuttle", "transport", "couple"),
      line("extraCars", "transport", "couple"),
      line("parking", "transport", "couple"),
    ],
  },
  {
    key: "parties",
    lines: [
      line("engagementParty", "other", "brideFamily"),
      line("rehearsalDinner", "catering", "groomFamily"),
      line("bachelorette", "other", "witnesses"),
      line("bachelor", "other", "witnesses"),
    ],
  },
  {
    key: "honeymoon",
    lines: [line("honeymoon", "honeymoon", "groomFamily")],
  },
  {
    key: "other",
    lines: [line("contingency", "contingency", "couple")],
  },
] as const satisfies readonly { key: string; lines: readonly LineDefinition[] }[];

export type BudgetSection = (typeof BUDGET_SECTIONS)[number]["key"];
export type BudgetLineKey = (typeof BUDGET_SECTIONS)[number]["lines"][number]["key"];
export const BUDGET_SECTION_KEYS = BUDGET_SECTIONS.map((section) => section.key) as BudgetSection[];

const LINES = new Map<string, LineDefinition & { section: BudgetSection }>(
  BUDGET_SECTIONS.flatMap((section) =>
    section.lines.map((entry) => [entry.key, { ...entry, section: section.key }] as const),
  ),
);
export const BUDGET_LINE_KEYS = [...LINES.keys()] as BudgetLineKey[];
export const lineDefinition = (key: string) => LINES.get(key) ?? null;
export const isBudgetLineKey = (key: string): key is BudgetLineKey => LINES.has(key);

/** Catégorie budgétaire des postes ajoutés par le couple dans une rubrique. */
export const SECTION_CATEGORY: Record<BudgetSection, BudgetCategory> = {
  ceremonyReception: "venue",
  food: "catering",
  attire: "attire",
  beauty: "beauty",
  rings: "rings",
  flowers: "decoration",
  photoVideo: "photography",
  entertainment: "music",
  stationery: "stationery",
  gifts: "other",
  transport: "transport",
  parties: "other",
  honeymoon: "honeymoon",
  other: "other",
};

/** Payeur traditionnel des postes ajoutés par le couple. */
export const SECTION_TRADITION: Record<BudgetSection, BudgetPayer> = {
  ceremonyReception: "shared",
  food: "shared",
  attire: "couple",
  beauty: "brideFamily",
  rings: "couple",
  flowers: "groomFamily",
  photoVideo: "brideFamily",
  entertainment: "brideFamily",
  stationery: "shared",
  gifts: "couple",
  transport: "couple",
  parties: "couple",
  honeymoon: "groomFamily",
  other: "couple",
};

/** Notice « selon la tradition » : rubriques présentées et leurs repères. */
export const TRADITION_NOTICE = [
  { key: "ceremony", entries: ["ceremonyVenue", "officiant"] },
  { key: "attire", entries: ["dress", "suit"] },
  { key: "flowers", entries: ["bouquet", "floral"] },
  { key: "reception", entries: ["catering", "music", "photo"] },
  { key: "parties", entries: ["engagement", "rehearsal", "bachelorette", "bachelor"] },
  { key: "rings", entries: ["groomRing", "brideRing"] },
  { key: "stationery", entries: ["invitations", "programs"] },
  { key: "transport", entries: ["car"] },
  { key: "honeymoon", entries: ["trip"] },
] as const;

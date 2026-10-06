/**
 * Idées du parcours d'ouverture de la liste de mariage. Les clés vivent ici,
 * les libellés dans les messages (Registry.catalog) : chaque idée retenue
 * devient un cadeau, rangé dans sa rubrique.
 */

/** Pièces de la maison (étape 1 : le quotidien). */
export const REGISTRY_ROOMS = {
  kitchen: ["dutchOven", "knives", "cuttingBoard", "pans", "jars", "mortar"],
  table: ["dinnerware", "wineGlasses", "flatware", "tablecloth", "servingDishes", "carafe"],
  linen: ["sheets", "duvet", "towels", "throw", "pillows"],
  appliances: ["coffee", "mixer", "vacuum", "blender", "steamer"],
  bathroom: ["bathrobes", "bathMat", "mirror", "diffuser"],
  decor: ["vase", "lamp", "frames", "rug", "plants"],
  outdoor: ["gardenFurniture", "barbecue", "hammock", "lanterns", "parasol"],
} as const;

/** Passions partagées (étape 2) : objets et expériences. */
export const REGISTRY_PASSIONS = {
  cooking: ["cookingClass", "cookbooks", "pastaMaker", "pizzaOven"],
  travel: ["luggage", "weekendAway", "camera", "travelJournal"],
  garden: ["gardenTools", "raisedBed", "fruitTrees", "greenhouse"],
  wine: ["wineCellar", "tasting", "decanter", "wineCourse"],
  outdoors: ["tent", "bikes", "paddle", "mountainHut"],
  culture: ["museumPass", "concertTickets", "artBooks", "theatre"],
  wellbeing: ["spaDuo", "yogaClasses", "retreat"],
  music: ["turntable", "speaker", "musicLessons", "festival"],
} as const;

/** Pièces de transmission (étape 3) : marquées « cadeau d'exception ». */
export const REGISTRY_HEIRLOOMS = [
  "silverFlatware",
  "crystalService",
  "embroideredLinen",
  "porcelain",
  "artwork",
  "craftFurniture",
] as const;

export type RegistryRoom = keyof typeof REGISTRY_ROOMS;
export type RegistryPassion = keyof typeof REGISTRY_PASSIONS;

export const ROOM_KEYS = Object.keys(REGISTRY_ROOMS) as RegistryRoom[];
export const PASSION_KEYS = Object.keys(REGISTRY_PASSIONS) as RegistryPassion[];

/**
 * Rubriques d'un cadeau, dans l'ordre d'affichage.
 * Alignées sur private.is_registry_section (000025_registry.sql).
 */
export const REGISTRY_SECTIONS = [...ROOM_KEYS, ...PASSION_KEYS, "heirloom", "other"] as const;
export type RegistrySection = RegistryRoom | RegistryPassion | "heirloom" | "other";

export function isRegistrySection(value: string): value is RegistrySection {
  return (REGISTRY_SECTIONS as readonly string[]).includes(value);
}

/** Projets de l'urne (étape 5). */
export const FUND_KINDS = ["honeymoon", "home", "life", "cause", "free"] as const;
export type FundKind = (typeof FUND_KINDS)[number];

/** Au-delà, l'urne se disperse : mieux vaut quelques projets qui racontent quelque chose. */
export const MAX_FUNDS = 3;

/** Clé de libellé d'une idée (Registry.catalog.ideas.<clé>). */
export type RegistryIdeaKey =
  | (typeof REGISTRY_ROOMS)[RegistryRoom][number]
  | (typeof REGISTRY_PASSIONS)[RegistryPassion][number]
  | (typeof REGISTRY_HEIRLOOMS)[number];

/** Idée du parcours : sa rubrique et sa clé de libellé. */
export type RegistryIdea = { section: RegistrySection; idea: RegistryIdeaKey; heirloom: boolean };

/** Toutes les idées du parcours, rubrique par rubrique. */
export const REGISTRY_IDEAS: readonly RegistryIdea[] = [
  ...ROOM_KEYS.flatMap((section) =>
    REGISTRY_ROOMS[section].map((idea) => ({ section, idea, heirloom: false })),
  ),
  ...PASSION_KEYS.flatMap((section) =>
    REGISTRY_PASSIONS[section].map((idea) => ({ section, idea, heirloom: false })),
  ),
  ...REGISTRY_HEIRLOOMS.map((idea) => ({ section: "heirloom" as const, idea, heirloom: true })),
];

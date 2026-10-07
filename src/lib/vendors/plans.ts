import { z } from "zod";
import type { VendorCategory } from "./catalog";
import {
  CAKE_SIZES,
  COCKTAIL_PARTS,
  DRINK_KEYS,
  GIFT_IDEAS,
  MENU_COURSES,
  STATION_IDEAS,
  STATIONERY_ITEMS,
  WEBSITE_ELEMENTS,
} from "./tools";

/*
 * Carnets des catégories (vendor_plans, 000032) : ce que le couple prépare
 * pour son mariage, indépendamment du prestataire retenu (menu, boissons,
 * préparatifs, mensurations, papeterie…). Un carnet par catégorie.
 */

const shortText = (max: number) => z.string().trim().max(max).catch("");
const time = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]).catch("");

/** Liste tolérante : une entrée invalide est écartée, pas toute la liste. */
const tolerantList = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((values) =>
      values
        .map((value) => item.safeParse(value))
        .filter((result) => result.success)
        .map((result) => result.data as z.output<T>)
        .slice(0, max),
    );

const keyList = <K extends readonly [string, ...string[]]>(keys: K) =>
  tolerantList(z.enum(keys), keys.length).transform((values) => [...new Set(values)]);

const cateringPlan = z.object({
  menu: z.object(Object.fromEntries(MENU_COURSES.map((course) => [course, shortText(400)]))).partial().catch({}),
  cocktail: z.object(Object.fromEntries(COCKTAIL_PARTS.map((part) => [part, shortText(600)]))).partial().catch({}),
  stations: keyList(STATION_IDEAS as unknown as readonly [string, ...string[]]),
  /** Boissons servies, pour le calcul des quantités. */
  drinks: keyList(DRINK_KEYS as unknown as readonly [string, ...string[]]),
});

const cakePlan = z.object({
  shape: z.enum(["round", "square"]).catch("round"),
  tiers: tolerantList(z.union(CAKE_SIZES.map((size) => z.literal(size))), CAKE_SIZES.length).transform((values) =>
    [...new Set(values)].sort((a, b) => a - b),
  ),
});

/** Préparatifs du matin, partagés par les pages Coiffeur et Maquilleuse. */
const gettingReadyPlan = z.object({
  readyBy: time,
  hairMinutes: z.number().int().min(10).max(180).catch(45),
  makeupMinutes: z.number().int().min(10).max(180).catch(40),
  people: tolerantList(
    z.object({ name: z.string().trim().min(1).max(60), hair: z.boolean(), makeup: z.boolean() }),
    20,
  ),
});

const ringsPlan = z.object({ brideSize: shortText(10), groomSize: shortText(10) });

const bridesmaidsPlan = z.object({
  members: tolerantList(
    z.object({ name: z.string().trim().min(1).max(60), size: shortText(20), style: shortText(80) }),
    20,
  ),
});

export const MEASUREMENTS = ["jacket", "neck", "waist", "leg", "shoe"] as const;
const measurements = z.object(Object.fromEntries(MEASUREMENTS.map((key) => [key, shortText(20)]))).partial();

const groomSuitPlan = z.object({ measures: measurements.catch({}) });

const groomsmenPlan = z.object({
  members: tolerantList(
    measurements.extend({ name: z.string().trim().min(1).max(60), notes: shortText(120) }),
    20,
  ),
});

const stationeryPlan = z.object({
  items: z
    .object(
      Object.fromEntries(
        STATIONERY_ITEMS.map((item) => [
          item,
          z
            .object({
              spec: shortText(120),
              quantity: z.number().int().min(0).max(5000).nullable().catch(null),
              cost: z.number().int().min(0).max(100000).nullable().catch(null),
              receivedOn: z.union([z.literal(""), z.iso.date()]).catch(""),
            })
            .partial()
            .catch({}),
        ]),
      ),
    )
    .partial()
    .catch({}),
});

const websitePlan = z.object({ done: keyList(WEBSITE_ELEMENTS as unknown as readonly [string, ...string[]]) });

const guestGiftsPlan = z.object({ ideas: keyList(GIFT_IDEAS as unknown as readonly [string, ...string[]]) });

/** Catégories qui ont un carnet, et la forme de ce carnet. */
export const PLAN_SCHEMAS = {
  catering: cateringPlan,
  cake: cakePlan,
  hair: gettingReadyPlan,
  rings: ringsPlan,
  bridesmaids: bridesmaidsPlan,
  groom_suit: groomSuitPlan,
  groomsmen: groomsmenPlan,
  stationery: stationeryPlan,
  website: websitePlan,
  guest_gifts: guestGiftsPlan,
} satisfies Partial<Record<VendorCategory, z.ZodType>>;

export type PlanCategory = keyof typeof PLAN_SCHEMAS;
export type PlanOf<C extends PlanCategory> = z.output<(typeof PLAN_SCHEMAS)[C]>;

export const PLAN_CATEGORIES = Object.keys(PLAN_SCHEMAS) as PlanCategory[];

/** Carnet affiché sur la page d'une catégorie (la maquilleuse lit celui du coiffeur). */
export function planCategoryFor(category: VendorCategory): PlanCategory | null {
  if (category === "makeup") return "hair";
  return (PLAN_CATEGORIES as string[]).includes(category) ? (category as PlanCategory) : null;
}

/** Lecture tolérante : un carnet absent ou illisible donne un carnet vide. */
export function readPlan<C extends PlanCategory>(category: C, raw: unknown): PlanOf<C> {
  const schema = PLAN_SCHEMAS[category] as unknown as z.ZodType<PlanOf<C>>;
  const parsed = schema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : (schema.parse({}) as PlanOf<C>);
}

import { z } from "zod";
import {
  INSPIRATION_OPTIONS,
  INSPIRATION_STEPS,
  inspirationLikesSchema,
  type InspirationLikes,
} from "./catalog";

/**
 * "Style DNA" stocké en JSONB (weddings.style_dna) : versionné pour pouvoir
 * l'enrichir sans migration. v2 : ambiance principale + coups de cœur du
 * swipe par étape (v1 ne contenait que l'ambiance).
 */
export const styleDnaSchema = z.object({
  version: z.literal(2),
  /** Lieu de référence (Reality Check, onboarding). */
  ambiance: z.enum(INSPIRATION_OPTIONS.venue).optional(),
  likes: inspirationLikesSchema,
});
export type StyleDna = z.infer<typeof styleDnaSchema>;

const styleDnaV1Schema = z.object({
  version: z.literal(1),
  ambiance: z.enum(INSPIRATION_OPTIONS.venue),
});

/** Lecture tolérante : v1 est convertie, une valeur illisible donne un carnet vide. */
export function readStyleDna(raw: unknown): StyleDna {
  const v2 = styleDnaSchema.safeParse(raw);
  if (v2.success) return v2.data;
  const v1 = styleDnaV1Schema.safeParse(raw);
  if (v1.success) {
    return { version: 2, ambiance: v1.data.ambiance, likes: { venue: [v1.data.ambiance] } };
  }
  return { version: 2, likes: {} };
}

/** Étapes déjà jouées (même sans coup de cœur), dans l'ordre du carnet. */
export function playedSteps(likes: InspirationLikes) {
  return INSPIRATION_STEPS.filter((step) => likes[step] !== undefined);
}

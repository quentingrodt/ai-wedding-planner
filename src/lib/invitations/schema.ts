import { z } from "zod";
import type { InspirationLikes } from "@/lib/inspiration/catalog";

/**
 * Faire-part : un design par mariage (table invitations, colonne design),
 * validé ici avant toute écriture. Le rendu est codé (modèles éditoriaux),
 * jamais généré en image : le texte reste net et exact.
 */

/** Modèles éditoriaux ; leur fiche (mise en page, style par défaut) vit dans templates.ts. */
export const INVITATION_TEMPLATES = [
  "classic",
  "garden",
  "seaside",
  "loft",
  "chronology",
  "eucalyptus",
  "monogram",
] as const;
export type InvitationTemplate = (typeof INVITATION_TEMPLATES)[number];

/** Palettes organiques : fond, encre, accent. */
export const INVITATION_PALETTES = {
  terracotta: { paper: "#f9f6f1", ink: "#2b2a28", accent: "#a9533a" },
  sage: { paper: "#f6f7f3", ink: "#2f3a2c", accent: "#6f8268" },
  sand: { paper: "#f4ede3", ink: "#3b3328", accent: "#a48661" },
  mist: { paper: "#f3f5f6", ink: "#283440", accent: "#6d8496" },
  ink: { paper: "#fbfaf8", ink: "#1f1f1e", accent: "#8a7f72" },
  autumn: { paper: "#faf3ea", ink: "#4a3426", accent: "#b4562c" },
} as const;
export type InvitationPalette = keyof typeof INVITATION_PALETTES;
export const PALETTE_KEYS = Object.keys(INVITATION_PALETTES) as InvitationPalette[];

/**
 * Paires typographiques (prénoms / textes) :
 * editorial — Playfair / Cormorant ; romantic — Cormorant italique / Cormorant ;
 * script — Pinyon / Cormorant ; engraved — Cormorant SC / Cormorant ;
 * modern — Allison / Jost.
 */
export const INVITATION_FONTS = ["editorial", "romantic", "script", "engraved", "modern"] as const;
export type InvitationFonts = (typeof INVITATION_FONTS)[number];

/** Pictogrammes au trait des moments du programme. */
export const MOMENT_ICONS = [
  "cityhall",
  "church",
  "arch",
  "glass",
  "dinner",
  "cake",
  "music",
  "brunch",
] as const;
export type MomentIcon = (typeof MOMENT_ICONS)[number];

/** Au-delà, le programme ne tient plus lisiblement sur un A5. */
export const MAX_MOMENTS = 4;

/** Pictogramme proposé pour le n-ième moment ajouté. */
export const DEFAULT_MOMENT_ICONS: readonly MomentIcon[] = ["cityhall", "church", "glass", "dinner"];


/**
 * booklet — livret plié de 4 pages A5 : couverture, intérieur (pages 2 et 3),
 * 4e de couverture. card — carte simple, toutes les informations au recto.
 */
export const INVITATION_FORMATS = ["booklet", "card"] as const;
export type InvitationFormat = (typeof INVITATION_FORMATS)[number];

/** Pages d'un livret, dans l'ordre de lecture. */
export const BOOKLET_PAGES = ["cover", "inside-left", "inside-right", "back"] as const;
export type BookletPage = (typeof BOOKLET_PAGES)[number];

/** Limites de saisie (affichage soigné sur un faire-part A5). */
export const INVITATION_LIMITS = {
  names: 60,
  coverHint: 60,
  families: 240,
  intro: 160,
  dateText: 60,
  time: 30,
  momentTitle: 60,
  venue: 80,
  address: 120,
  rsvpNote: 140,
  contact: 140,
  closingNote: 200,
} as const;

const text = (max: number) => z.string().trim().max(max);

/** Un moment du programme : mairie, cérémonie, vin d'honneur, dîner… */
export const invitationMomentSchema = z.object({
  time: text(INVITATION_LIMITS.time),
  /** Ex. « Cérémonie à l'église ». */
  title: text(INVITATION_LIMITS.momentTitle),
  venue: text(INVITATION_LIMITS.venue),
  address: text(INVITATION_LIMITS.address),
  icon: z.enum(MOMENT_ICONS),
});
export type InvitationMoment = z.infer<typeof invitationMomentSchema>;

export const invitationContentSchema = z.object({
  /** Prénoms du couple, ex. « Camille & Thomas ». */
  names: text(INVITATION_LIMITS.names).min(1),
  /** Repères de couverture, ex. « 24 · 06 · 2027 — Beaune ». */
  coverHint: text(INVITATION_LIMITS.coverHint),
  /**
   * Annonce des familles, facultative (chaîne vide = absente), sur plusieurs
   * lignes : « M. et Mme Martin… ont la joie de vous annoncer… ».
   */
  families: text(INVITATION_LIMITS.families),
  /** Phrase d'invitation, ex. « ont la joie de vous convier à leur mariage ». */
  intro: text(INVITATION_LIMITS.intro),
  /** Date en toutes lettres, libre (ex. « Samedi 12 juin 2027 »). */
  dateText: text(INVITATION_LIMITS.dateText),
  /** Programme de la journée, dans l'ordre. */
  moments: z.array(invitationMomentSchema).max(MAX_MOMENTS),
  /** Mention de réponse, ex. « Réponse souhaitée avant le 1er mai ». */
  rsvpNote: text(INVITATION_LIMITS.rsvpNote),
  /** Contact libre, ex. « Camille : 06 12 34 56 78 ». */
  contact: text(INVITATION_LIMITS.contact),
  /** Mot de fin de la 4e de couverture. */
  closingNote: text(INVITATION_LIMITS.closingNote),
});
export type InvitationContent = z.infer<typeof invitationContentSchema>;

const style = {
  template: z.enum(INVITATION_TEMPLATES),
  palette: z.enum(PALETTE_KEYS as [InvitationPalette, ...InvitationPalette[]]),
  fonts: z.enum(INVITATION_FONTS),
};

const designV3Schema = z.object({
  version: z.literal(3),
  format: z.enum(INVITATION_FORMATS),
  ...style,
  content: invitationContentSchema,
});
export type InvitationDesign = z.infer<typeof designV3Schema>;

/** Deuxième version : carte simple uniquement, sans couverture ni mot de fin. */
const designV2Schema = z.object({
  version: z.literal(2),
  ...style,
  content: invitationContentSchema.omit({ coverHint: true, families: true, closingNote: true }),
});

/** Première version : une seule heure, un seul lieu, pas de contact. */
const designV1Schema = z.object({
  version: z.literal(1),
  template: z.enum(["classic", "garden", "seaside", "loft"]),
  palette: z.enum(["terracotta", "sage", "sand", "mist", "ink"]),
  fonts: z.enum(["editorial", "romantic", "script"]),
  content: z.object({
    names: text(INVITATION_LIMITS.names).min(1),
    intro: text(INVITATION_LIMITS.intro),
    dateText: text(INVITATION_LIMITS.dateText),
    time: text(INVITATION_LIMITS.time),
    venue: text(INVITATION_LIMITS.venue),
    address: text(INVITATION_LIMITS.address),
    rsvpNote: text(INVITATION_LIMITS.rsvpNote),
  }),
});

/** v2 → v3 : le faire-part reste une carte simple, telle que le couple l'a composée. */
function upgradeDesignV2(design: z.infer<typeof designV2Schema>): InvitationDesign {
  return {
    ...design,
    version: 3,
    format: "card",
    content: { ...design.content, coverHint: "", families: "", closingNote: "" },
  };
}

/** v1 → v3 : son heure et son lieu deviennent le premier moment du programme. */
function upgradeDesignV1(design: z.infer<typeof designV1Schema>): InvitationDesign {
  const { time, venue, address, ...content } = design.content;
  return upgradeDesignV2({
    ...design,
    version: 2,
    content: {
      ...content,
      moments: time || venue || address ? [{ time, title: "", venue, address, icon: "church" }] : [],
      contact: "",
    },
  });
}

/** Design lu ou écrit : les versions précédentes sont converties à la lecture. */
export const invitationDesignSchema = z.union([
  designV3Schema,
  designV2Schema.transform(upgradeDesignV2),
  designV1Schema.transform(upgradeDesignV1),
]);

/** Modèle et palette suggérés par l'ambiance de lieu du carnet. */
const BY_VENUE = {
  chateau: { template: "classic", palette: "terracotta", fonts: "editorial" },
  countryside: { template: "garden", palette: "sage", fonts: "romantic" },
  beach: { template: "seaside", palette: "mist", fonts: "romantic" },
  urban: { template: "loft", palette: "ink", fonts: "editorial" },
} as const satisfies Record<
  string,
  { template: InvitationTemplate; palette: InvitationPalette; fonts: InvitationFonts }
>;

/**
 * Premier design proposé : un livret, style déduit du carnet (lieu aimé),
 * textes pré-remplis avec les informations du mariage. Les textes traduits
 * sont fournis par l'appelant (aucun texte en dur ici).
 */
export function suggestInvitationDesign({
  likes,
  ambiance,
  names,
  coverHint,
  dateText,
  intro,
  rsvpNote,
  closingNote,
}: {
  likes: InspirationLikes;
  ambiance?: keyof typeof BY_VENUE;
  names: string;
  coverHint: string;
  dateText: string;
  intro: string;
  rsvpNote: string;
  closingNote: string;
}): InvitationDesign {
  const venue = likes.venue?.[0] ?? ambiance ?? "chateau";
  return {
    version: 3,
    format: "booklet",
    ...BY_VENUE[venue],
    content: {
      names: names.slice(0, INVITATION_LIMITS.names),
      coverHint,
      families: "",
      intro,
      dateText,
      moments: [],
      rsvpNote,
      contact: "",
      closingNote,
    },
  };
}

export type SaveInvitationResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "unauthenticated" | "forbidden" | "generic" };

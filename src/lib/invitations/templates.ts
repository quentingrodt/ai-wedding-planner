import type {
  InvitationFonts,
  InvitationPalette,
  InvitationTemplate,
} from "./schema";

/**
 * Fiches des modèles : ajouter un modèle revient à ajouter une fiche ici,
 * son ornement (ornaments.tsx) et son nom (messages, Invitations.templates).
 */

/** Ambiances de lieu du carnet d'inspiration, qui servent de filtres. */
export const TEMPLATE_AMBIANCES = ["chateau", "countryside", "beach", "urban"] as const;
export type TemplateAmbiance = (typeof TEMPLATE_AMBIANCES)[number];

/**
 * centered — texte centré, programme empilé (modèles d'origine) ;
 * timeline — frise horaire avec pictogrammes, puis les lieux ;
 * botanical — prénoms sur deux lignes, programme en paragraphes, brin en séparateur.
 */
export type TemplateLayout = "centered" | "timeline" | "botanical";

export type TemplateSpec = {
  layout: TemplateLayout;
  /** Ambiances pour lesquelles le modèle est recommandé. */
  ambiances: readonly TemplateAmbiance[];
  /** Style appliqué quand on choisit le modèle (modifiable ensuite). */
  defaults: { palette: InvitationPalette; fonts: InvitationFonts };
  /** Marges de la zone de texte dans le repère 600 × 851, selon les ornements. */
  space: { top: number; bottom: number; side: number };
  /** Marges haute et basse des pages intérieures du livret (ornement allégé). */
  inside: { top: number; bottom: number };
  /** Prénoms sur deux lignes (« Pauline / & Antoine »). */
  splitNames?: boolean;
  /** Initiales dans une couronne, en pied de carte. */
  monogram?: boolean;
};

export const TEMPLATE_SPECS: Record<InvitationTemplate, TemplateSpec> = {
  classic: {
    layout: "centered",
    ambiances: ["chateau"],
    defaults: { palette: "terracotta", fonts: "editorial" },
    space: { top: 140, bottom: 80, side: 86 },
    inside: { top: 110, bottom: 90 },
  },
  garden: {
    layout: "centered",
    ambiances: ["countryside"],
    defaults: { palette: "sage", fonts: "romantic" },
    space: { top: 170, bottom: 112, side: 86 },
    inside: { top: 90, bottom: 130 },
  },
  seaside: {
    layout: "centered",
    ambiances: ["beach"],
    defaults: { palette: "mist", fonts: "romantic" },
    space: { top: 215, bottom: 118, side: 86 },
    inside: { top: 90, bottom: 140 },
  },
  loft: {
    layout: "centered",
    ambiances: ["urban"],
    defaults: { palette: "ink", fonts: "editorial" },
    space: { top: 290, bottom: 76, side: 86 },
    inside: { top: 160, bottom: 80 },
  },
  chronology: {
    layout: "timeline",
    ambiances: ["chateau", "countryside", "urban"],
    defaults: { palette: "ink", fonts: "engraved" },
    space: { top: 150, bottom: 56, side: 44 },
    inside: { top: 80, bottom: 70 },
  },
  eucalyptus: {
    layout: "botanical",
    ambiances: ["countryside", "beach"],
    defaults: { palette: "sage", fonts: "modern" },
    space: { top: 120, bottom: 70, side: 80 },
    inside: { top: 140, bottom: 70 },
    splitNames: true,
  },
  monogram: {
    layout: "centered",
    ambiances: ["countryside", "chateau"],
    defaults: { palette: "autumn", fonts: "script" },
    space: { top: 150, bottom: 150, side: 90 },
    inside: { top: 180, bottom: 80 },
    splitNames: true,
    monogram: true,
  },
};

/** Modèles recommandés d'abord, puis l'ordre du catalogue. */
export function sortTemplatesFor(
  ambiance: TemplateAmbiance | null,
  templates: readonly InvitationTemplate[],
): InvitationTemplate[] {
  if (!ambiance) return [...templates];
  const recommended = (template: InvitationTemplate) =>
    TEMPLATE_SPECS[template].ambiances.includes(ambiance) ? 0 : 1;
  return [...templates].sort((a, b) => recommended(a) - recommended(b));
}

/** « Pauline & Antoine » → ["Pauline", "& Antoine"] ; inchangé sans séparateur. */
export function splitNames(names: string): string[] {
  const match = /^(.+?)\s+(&|et|and|y|und)\s+(.+)$/i.exec(names.trim());
  return match ? [match[1], `${match[2]} ${match[3]}`] : [names];
}

/** « Pauline & Antoine » → « PA » ; à défaut, la première lettre. */
export function monogramInitials(names: string): string {
  const match = /^(.+?)\s+(?:&|et|and|y|und)\s+(.+)$/i.exec(names.trim());
  const parts = match ? [match[1], match[2]] : [names.trim()];
  return parts
    .map((part) => part.trim().charAt(0).toLocaleUpperCase())
    .join("");
}

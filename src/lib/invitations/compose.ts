import {
  INVITATION_LIMITS,
  INVITATION_TEMPLATES,
  MAX_MOMENTS,
  MOMENT_ICONS,
  type InvitationDesign,
  type InvitationFonts,
  type InvitationFormat,
  type InvitationMoment,
  type InvitationPalette,
  type InvitationTemplate,
  type MomentIcon,
} from "./schema";
import { TEMPLATE_SPECS, type TemplateAmbiance } from "./templates";

/**
 * Composition d'un premier faire-part à partir du questionnaire : choix du
 * style et assemblage des textes, sans calcul confié à l'IA. Les textes
 * traduits sont fournis par l'appelant (aucun texte en dur ici).
 */

/** Ton recherché : il oriente le modèle et la typographie. */
export const INVITATION_TONES = ["classic", "romantic", "modern"] as const;
export type InvitationTone = (typeof INVITATION_TONES)[number];

/** Lieux à renseigner, selon les moments choisis. */
export const PLACE_KINDS = ["cityhall", "ceremony", "reception", "brunch"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

const PLACE_OF: Record<MomentIcon, PlaceKind> = {
  cityhall: "cityhall",
  church: "ceremony",
  arch: "ceremony",
  glass: "reception",
  dinner: "reception",
  cake: "reception",
  music: "reception",
  brunch: "brunch",
};

/** Lieux demandés pour ces moments, dans l'ordre de la journée. */
export function placesFor(icons: readonly MomentIcon[]): PlaceKind[] {
  return PLACE_KINDS.filter((kind) => icons.some((icon) => PLACE_OF[icon] === kind));
}

export type Place = { venue: string; address: string };

export type CompositionAnswers = {
  names: string;
  dateText: string;
  format: InvitationFormat;
  ambiance: TemplateAmbiance;
  tone: InvitationTone;
  /** Moments retenus et leur heure (facultative), dans n'importe quel ordre. */
  moments: readonly { icon: MomentIcon; time: string }[];
  places: Partial<Record<PlaceKind, Place>>;
  families: boolean;
  rsvpNote: string;
  contact: string;
};

/** Textes traduits que la composition assemble. */
export type CompositionTexts = {
  intro: string;
  closingNote: string;
  families: string;
  /** Date courte de couverture (« 24 · 06 · 2027 »), ou chaîne vide. */
  coverDate: string;
  momentTitles: Record<MomentIcon, string>;
};

type Style = { template: InvitationTemplate; fonts: InvitationFonts; palette: InvitationPalette };

/** Proposition principale pour chaque ambiance et chaque ton. */
const PRIMARY_STYLE: Record<TemplateAmbiance, Record<InvitationTone, Style>> = {
  chateau: {
    classic: { template: "classic", fonts: "editorial", palette: "terracotta" },
    romantic: { template: "monogram", fonts: "script", palette: "autumn" },
    modern: { template: "chronology", fonts: "engraved", palette: "ink" },
  },
  countryside: {
    classic: { template: "garden", fonts: "romantic", palette: "sage" },
    romantic: { template: "monogram", fonts: "script", palette: "autumn" },
    modern: { template: "eucalyptus", fonts: "modern", palette: "sage" },
  },
  beach: {
    classic: { template: "seaside", fonts: "romantic", palette: "mist" },
    romantic: { template: "seaside", fonts: "script", palette: "mist" },
    modern: { template: "eucalyptus", fonts: "modern", palette: "mist" },
  },
  urban: {
    classic: { template: "loft", fonts: "editorial", palette: "ink" },
    romantic: { template: "loft", fonts: "romantic", palette: "sand" },
    modern: { template: "chronology", fonts: "engraved", palette: "ink" },
  },
};

/**
 * Propositions successives : d'abord celle qui répond à l'ambiance et au ton,
 * puis les autres modèles de l'ambiance, puis le reste du catalogue.
 */
export function stylesFor(ambiance: TemplateAmbiance, tone: InvitationTone): Style[] {
  const primary = PRIMARY_STYLE[ambiance][tone];
  const others = INVITATION_TEMPLATES.filter((template) => template !== primary.template).sort(
    (a, b) =>
      Number(!TEMPLATE_SPECS[a].ambiances.includes(ambiance)) -
      Number(!TEMPLATE_SPECS[b].ambiances.includes(ambiance)),
  );
  return [primary, ...others.map((template) => ({ template, ...TEMPLATE_SPECS[template].defaults }))];
}

/** « Route des Vignes, 21200 Beaune » → « Beaune ». */
export function cityOf(address: string): string {
  const last = address.split(",").at(-1) ?? "";
  return last.replace(/\d+/g, "").trim();
}

/** Moments proposés d'office, d'après le type de cérémonie déjà connu. */
export function suggestedMoments({
  religious,
  secular,
}: {
  religious: boolean;
  secular: boolean;
}): MomentIcon[] {
  const icons: MomentIcon[] = ["cityhall"];
  if (religious) icons.push("church");
  if (secular) icons.push("arch");
  icons.push("glass", "dinner");
  return icons.slice(0, MAX_MOMENTS);
}

/** Le faire-part composé ; variant fait défiler les propositions alternatives. */
export function composeInvitation(
  answers: CompositionAnswers,
  texts: CompositionTexts,
  variant = 0,
): InvitationDesign {
  const styles = stylesFor(answers.ambiance, answers.tone);
  const style = styles[variant % styles.length];

  const place = (kind: PlaceKind): Place => {
    const own = answers.places[kind];
    if (own && (own.venue || own.address)) return own;
    // Cérémonie et lendemain sans lieu propre : au même endroit que la réception.
    if (kind === "ceremony" || kind === "brunch") return answers.places.reception ?? { venue: "", address: "" };
    return { venue: "", address: "" };
  };

  const moments: InvitationMoment[] = MOMENT_ICONS.flatMap((icon) => {
    const chosen = answers.moments.find((moment) => moment.icon === icon);
    if (!chosen) return [];
    const { venue, address } = place(PLACE_OF[icon]);
    return [
      {
        icon,
        time: chosen.time.trim().slice(0, INVITATION_LIMITS.time),
        title: texts.momentTitles[icon].slice(0, INVITATION_LIMITS.momentTitle),
        venue: venue.trim().slice(0, INVITATION_LIMITS.venue),
        address: address.trim().slice(0, INVITATION_LIMITS.address),
      },
    ];
  }).slice(0, MAX_MOMENTS);

  const city = cityOf(answers.places.reception?.address ?? "");
  const coverHint = [texts.coverDate, city].filter(Boolean).join(" — ");

  return {
    version: 3,
    format: answers.format,
    ...style,
    content: {
      names: answers.names.trim().slice(0, INVITATION_LIMITS.names),
      coverHint: coverHint.slice(0, INVITATION_LIMITS.coverHint),
      families: answers.families ? texts.families : "",
      intro: texts.intro,
      dateText: answers.dateText.trim().slice(0, INVITATION_LIMITS.dateText),
      moments,
      rsvpNote: answers.rsvpNote.trim().slice(0, INVITATION_LIMITS.rsvpNote),
      contact: answers.contact.trim().slice(0, INVITATION_LIMITS.contact),
      closingNote: texts.closingNote,
    },
  };
}

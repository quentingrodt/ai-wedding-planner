import type { CSSProperties } from "react";
import { CARD_VIEWBOX, Ornament } from "./ornaments";
import { INVITATION_PALETTES, type InvitationDesign, type InvitationFonts } from "./schema";

/** Familles de polices à utiliser : variables CSS (navigateur) ou noms (export). */
export type InvitationFamilies = {
  playfair: string;
  cormorant: string;
  script: string;
};

/** Format A5 portrait (148 × 210 mm). */
export const CARD_RATIO = CARD_VIEWBOX.height / CARD_VIEWBOX.width;

const NAME_FONT: Record<InvitationFonts, keyof InvitationFamilies> = {
  editorial: "playfair",
  romantic: "cormorant",
  script: "script",
};

/** Marges haute et basse de la zone de texte, selon les ornements du modèle. */
const TOP_SPACE: Record<InvitationDesign["template"], number> = {
  classic: 140,
  garden: 170,
  seaside: 215,
  loft: 290,
};
/** Distance entre la mention de réponse et le bas de la carte (au-dessus des ornements). */
const BOTTOM_SPACE: Record<InvitationDesign["template"], number> = {
  classic: 80,
  garden: 112,
  seaside: 118,
  loft: 76,
};

type InvitationCardProps = {
  design: InvitationDesign;
  /** Largeur rendue en pixels ; tout le reste est proportionnel. */
  width: number;
  families: InvitationFamilies;
  /** Mention en filigrane (aperçu non débloqué), ou rien. */
  watermark?: string;
};

/**
 * Rendu d'un faire-part, en styles en ligne et flexbox uniquement : le même
 * composant sert à l'aperçu, à l'export image (ImageResponse) et au PDF.
 * Chaque div à plusieurs enfants déclare display: flex (exigence de satori).
 */
export function InvitationCard({ design, width, families, watermark }: InvitationCardProps) {
  const { content, template, fonts } = design;
  const palette = INVITATION_PALETTES[design.palette];
  const u = width / CARD_VIEWBOX.width;
  const px = (value: number) => value * u;

  const nameFamily = families[NAME_FONT[fonts]];
  const textStyle: CSSProperties = {
    fontFamily: families.cormorant,
    color: palette.ink,
    textAlign: "center",
  };
  const caps: CSSProperties = {
    ...textStyle,
    fontSize: px(17),
    letterSpacing: px(4.5),
    textTransform: "uppercase",
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width,
        height: width * CARD_RATIO,
        backgroundColor: palette.paper,
        overflow: "hidden",
      }}
    >
      <Ornament template={template} color={palette.accent} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          flexGrow: 1,
          paddingTop: px(TOP_SPACE[template]),
          paddingBottom: px(24),
          paddingLeft: px(86),
          paddingRight: px(86),
        }}
      >
        <div
          style={{
            fontFamily: nameFamily,
            fontSize: px(fonts === "script" ? 70 : 56),
            fontStyle: fonts === "romantic" ? "italic" : "normal",
            lineHeight: 1.15,
            color: palette.ink,
            textAlign: "center",
          }}
        >
          {content.names}
        </div>

        {content.intro && (
          <div
            style={{
              ...textStyle,
              marginTop: px(24),
              fontSize: px(22),
              fontStyle: "italic",
              lineHeight: 1.45,
              opacity: 0.85,
            }}
          >
            {content.intro}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", marginTop: px(34), marginBottom: px(30) }}>
          <div style={{ width: px(46), height: px(1), backgroundColor: palette.accent }} />
          <div
            style={{
              width: px(6),
              height: px(6),
              marginLeft: px(10),
              marginRight: px(10),
              borderRadius: px(6),
              backgroundColor: palette.accent,
            }}
          />
          <div style={{ width: px(46), height: px(1), backgroundColor: palette.accent }} />
        </div>

        {content.dateText && <div style={caps}>{content.dateText}</div>}
        {content.time && (
          <div style={{ ...textStyle, marginTop: px(10), fontSize: px(20) }}>{content.time}</div>
        )}

        {content.venue && (
          <div
            style={{
              fontFamily: families.playfair,
              marginTop: px(32),
              fontSize: px(30),
              lineHeight: 1.25,
              color: palette.ink,
              textAlign: "center",
            }}
          >
            {content.venue}
          </div>
        )}
        {content.address && (
          <div style={{ ...textStyle, marginTop: px(10), fontSize: px(18), lineHeight: 1.4, opacity: 0.8 }}>
            {content.address}
          </div>
        )}
      </div>

      {/* Dans le flux, en pied : elle repousse le contenu au lieu de le chevaucher. */}
      {content.rsvpNote && (
        <div
          style={{
            ...textStyle,
            display: "flex",
            justifyContent: "center",
            marginBottom: px(BOTTOM_SPACE[template]),
            paddingLeft: px(86),
            paddingRight: px(86),
            fontSize: px(17),
            fontStyle: "italic",
            color: palette.accent,
          }}
        >
          {content.rsvpNote}
        </div>
      )}

      {watermark && (
        <div
          style={{
            position: "absolute",
            bottom: px(14),
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontFamily: families.cormorant,
            fontSize: px(12),
            letterSpacing: px(3),
            textTransform: "uppercase",
            color: palette.ink,
            opacity: 0.45,
          }}
        >
          {watermark}
        </div>
      )}
    </div>
  );
}

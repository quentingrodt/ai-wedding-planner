import type { CSSProperties, ReactNode } from "react";
import { MomentIconSvg } from "./icons";
import { CARD_VIEWBOX, MonogramWreath, Ornament } from "./ornaments";
import {
  INVITATION_PALETTES,
  type InvitationDesign,
  type InvitationFonts,
  type InvitationMoment,
} from "./schema";
import { monogramInitials, splitNames, TEMPLATE_SPECS } from "./templates";

/** Familles de polices à utiliser : variables CSS (navigateur) ou noms (export). */
export type InvitationFamilies = {
  playfair: string;
  cormorant: string;
  /** Cormorant SC : petites capitales gravées. */
  smallCaps: string;
  /** Pinyon Script : calligraphie classique. */
  script: string;
  /** Allison : calligraphie moderne, au fil de la plume. */
  signature: string;
  /** Jost : sans-serif fine. */
  sans: string;
};

/** Format A5 portrait (148 × 210 mm). */
export const CARD_RATIO = CARD_VIEWBOX.height / CARD_VIEWBOX.width;

/** Famille des prénoms pour chaque paire typographique. */
export const NAME_FONT: Record<InvitationFonts, keyof InvitationFamilies> = {
  editorial: "playfair",
  romantic: "cormorant",
  script: "script",
  engraved: "smallCaps",
  modern: "signature",
};
const BODY_FONT: Record<InvitationFonts, keyof InvitationFamilies> = {
  editorial: "cormorant",
  romantic: "cormorant",
  script: "cormorant",
  engraved: "cormorant",
  modern: "sans",
};
/** Corps des prénoms : les calligraphies ont un petit œil, les capitales prennent de la place. */
const NAME_SIZE: Record<InvitationFonts, number> = {
  editorial: 56,
  romantic: 56,
  script: 70,
  engraved: 52,
  modern: 92,
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
  const spec = TEMPLATE_SPECS[template];
  const palette = INVITATION_PALETTES[design.palette];
  const u = width / CARD_VIEWBOX.width;
  const moments = content.moments;
  // Plus le programme est long, plus la composition se resserre pour tenir sur la carte.
  const density = moments.length <= 1 ? 1 : moments.length === 2 ? 0.92 : 0.82;
  const px = (value: number) => value * u;
  const dx = (value: number) => value * u * density;

  const body = families[BODY_FONT[fonts]];
  const sans = fonts === "modern";
  const textStyle: CSSProperties = {
    fontFamily: body,
    color: palette.ink,
    textAlign: "center",
    fontWeight: sans ? 300 : 400,
  };
  const caps: CSSProperties = {
    ...textStyle,
    fontSize: dx(sans ? 15 : 17),
    letterSpacing: px(4.5),
    textTransform: "uppercase",
  };
  const column: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center" };

  const nameLines = spec.splitNames ? splitNames(content.names) : [content.names];
  const names = (
    <div style={{ ...column }}>
      {nameLines.map((line, index) => (
        <div
          key={index}
          style={{
            fontFamily: families[NAME_FONT[fonts]],
            fontSize: dx(NAME_SIZE[fonts]),
            fontStyle: fonts === "romantic" ? "italic" : "normal",
            fontWeight: fonts === "engraved" ? 500 : 400,
            letterSpacing: fonts === "engraved" ? px(1.5) : 0,
            lineHeight: fonts === "modern" ? 0.95 : 1.15,
            color: spec.monogram ? palette.accent : palette.ink,
            textAlign: "center",
            // « & Antoine » décalé vers la droite, comme une signature.
            marginLeft: index > 0 && nameLines.length > 1 ? dx(70) : 0,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );

  const intro = content.intro ? (
    <div
      style={{
        ...textStyle,
        marginTop: dx(spec.layout === "timeline" ? 12 : 22),
        fontSize: dx(sans ? 18 : 22),
        fontStyle: sans || spec.layout === "timeline" ? "normal" : "italic",
        lineHeight: 1.45,
        opacity: 0.85,
      }}
    >
      {content.intro}
    </div>
  ) : null;

  const dotRule = (
    <div style={{ display: "flex", alignItems: "center", marginTop: dx(30), marginBottom: dx(26) }}>
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
  );

  const sprigRule = (
    <div style={{ display: "flex", marginTop: dx(18), marginBottom: dx(18) }}>
      <svg width={px(110)} height={px(26)} viewBox="0 0 110 26" fill="none">
        <path
          d="M8 14 C35 10 75 10 102 14 M30 12 c-4 -9 6 -10 6 -2 M30 12 c-3 8 7 8 6 1 M55 11 c-4 -9 6 -10 6 -2 M55 11 c-3 8 7 8 6 1 M80 12 c-4 -9 6 -10 6 -2 M80 12 c-3 8 7 8 6 1"
          stroke={palette.accent}
          strokeWidth={1.1}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  const dateStyle: CSSProperties =
    spec.layout === "timeline"
      ? { ...textStyle, marginTop: dx(30), fontSize: dx(40) }
      : spec.layout === "botanical"
        ? { ...textStyle, fontSize: dx(sans ? 42 : 40), fontWeight: 400, letterSpacing: px(1) }
        : spec.monogram
          ? {
              ...textStyle,
              fontFamily: families.script,
              fontSize: dx(40),
              color: palette.accent,
              marginTop: dx(6),
            }
          : caps;
  const date = content.dateText ? <div style={dateStyle}>{content.dateText}</div> : null;

  const rsvp = (content.rsvpNote !== "" || content.contact !== "") && (
    <div style={{ ...column, gap: dx(6) }}>
      {content.rsvpNote && (
        <div
          style={
            spec.layout === "timeline"
              ? { ...textStyle, fontFamily: families.smallCaps, fontSize: dx(19), fontWeight: 500 }
              : {
                  ...textStyle,
                  fontSize: dx(sans ? 15 : 17),
                  fontStyle: sans ? "normal" : "italic",
                  color: palette.accent,
                }
          }
        >
          {content.rsvpNote}
        </div>
      )}
      {content.contact && (
        <div style={{ ...textStyle, fontSize: dx(sans ? 13 : 16), opacity: 0.8 }}>
          {content.contact}
        </div>
      )}
    </div>
  );

  let main: ReactNode;
  if (spec.layout === "timeline") {
    main = (
      <div style={{ ...column, width: "100%" }}>
        {names}
        {intro}
        {date}
        {moments.length > 0 && (
          <Timeline moments={moments} u={u} density={density} palette={palette} textStyle={textStyle} smallCaps={families.smallCaps} />
        )}
        <Venues moments={moments} dx={dx} palette={palette} textStyle={textStyle} smallCaps={families.smallCaps} />
      </div>
    );
  } else if (spec.layout === "botanical") {
    main = (
      <div style={{ ...column, width: "100%" }}>
        {names}
        {intro}
        {date && <div style={{ display: "flex", marginTop: dx(22) }}>{date}</div>}
        <MomentParagraphs moments={moments} dx={dx} textStyle={textStyle} />
        {moments.length > 0 && sprigRule}
      </div>
    );
  } else {
    main = (
      <div style={{ ...column, width: "100%" }}>
        {names}
        {intro}
        {dotRule}
        {date}
        <StackedMoments moments={moments} dx={dx} textStyle={textStyle} caps={caps} venueFamily={families.playfair} palette={palette} />
      </div>
    );
  }

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
          ...column,
          justifyContent: "center",
          width: "100%",
          flexGrow: 1,
          paddingTop: px(spec.space.top),
          paddingBottom: px(20),
          paddingLeft: px(spec.space.side),
          paddingRight: px(spec.space.side),
        }}
      >
        {main}
      </div>

      {/* Dans le flux, en pied : elle repousse le contenu au lieu de le chevaucher. */}
      {rsvp && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: px(spec.space.bottom),
            paddingLeft: px(spec.space.side),
            paddingRight: px(spec.space.side),
          }}
        >
          {rsvp}
        </div>
      )}

      {spec.monogram && (
        <div
          style={{
            position: "absolute",
            right: px(34),
            bottom: px(30),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: px(118),
            height: px(118),
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
            <MonogramWreath color={palette.accent} size={px(118)} />
          </div>
          <div style={{ fontFamily: families.script, fontSize: px(40), color: palette.accent }}>
            {monogramInitials(content.names)}
          </div>
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

type Palette = (typeof INVITATION_PALETTES)[keyof typeof INVITATION_PALETTES];

/** Moments empilés : intitulé et heure en capitales, puis le lieu et l'adresse. */
function StackedMoments({
  moments,
  dx,
  textStyle,
  caps,
  venueFamily,
  palette,
}: {
  moments: InvitationMoment[];
  dx: (value: number) => number;
  textStyle: CSSProperties;
  caps: CSSProperties;
  venueFamily: string;
  palette: Palette;
}) {
  const single = moments.length === 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: dx(22), marginTop: dx(single ? 10 : 26) }}>
      {moments.map((moment, index) => {
        const heading = [moment.title, moment.time].filter(Boolean).join(" · ");
        // Même lieu que le moment précédent : on ne le répète pas.
        const previous = moments[index - 1];
        const samePlace =
          previous !== undefined &&
          previous.venue === moment.venue &&
          previous.address === moment.address;
        if (samePlace) moment = { ...moment, venue: "", address: "" };
        return (
          <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {heading &&
              (single && !moment.title ? (
                <div style={{ ...textStyle, fontSize: dx(20) }}>{heading}</div>
              ) : (
                <div style={{ ...caps, fontSize: dx(14), letterSpacing: dx(3.5), color: palette.accent }}>
                  {heading}
                </div>
              ))}
            {moment.venue && (
              <div
                style={{
                  fontFamily: venueFamily,
                  marginTop: dx(single ? 26 : 6),
                  fontSize: dx(single ? 30 : 24),
                  lineHeight: 1.25,
                  color: palette.ink,
                  textAlign: "center",
                }}
              >
                {moment.venue}
              </div>
            )}
            {moment.address && (
              <div style={{ ...textStyle, marginTop: dx(6), fontSize: dx(17), lineHeight: 1.4, opacity: 0.8 }}>
                {moment.address}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Moments en paragraphes : « 16h30 — Cérémonie laïque », puis le lieu. */
function MomentParagraphs({
  moments,
  dx,
  textStyle,
}: {
  moments: InvitationMoment[];
  dx: (value: number) => number;
  textStyle: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: dx(16), marginTop: dx(22) }}>
      {moments.map((moment, index) => {
        const heading = [moment.time, moment.title].filter(Boolean).join(" — ");
        const place = [moment.venue, moment.address].filter(Boolean).join(", ");
        return (
          <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {heading && <div style={{ ...textStyle, fontSize: dx(18), fontWeight: 400 }}>{heading}</div>}
            {place && (
              <div style={{ ...textStyle, marginTop: dx(3), fontSize: dx(16), lineHeight: 1.4, opacity: 0.85 }}>
                {place}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Frise horaire : heures, ligne pointée, pictogrammes et intitulés. */
function Timeline({
  moments,
  u,
  density,
  palette,
  textStyle,
  smallCaps,
}: {
  moments: InvitationMoment[];
  u: number;
  density: number;
  palette: Palette;
  textStyle: CSSProperties;
  smallCaps: string;
}) {
  const px = (value: number) => value * u;
  const line = { flexGrow: 1, height: px(1.2), backgroundColor: palette.ink };
  return (
    <div style={{ display: "flex", width: "100%", marginTop: px(34 * density) }}>
      {moments.map((moment, index) => (
        <div
          key={index}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, flexBasis: 0 }}
        >
          <div style={{ ...textStyle, fontFamily: smallCaps, fontSize: px(19), height: px(26) }}>{moment.time}</div>
          <div style={{ display: "flex", alignItems: "center", width: "100%", marginTop: px(8) }}>
            <div style={line} />
            <div style={{ width: px(9), height: px(9), borderRadius: px(9), backgroundColor: palette.ink }} />
            <div style={line} />
          </div>
          <div style={{ display: "flex", marginTop: px(14) }}>
            <MomentIconSvg icon={moment.icon} color={palette.ink} size={px(88 * density)} />
          </div>
          {moment.title && (
            <div
              style={{
                ...textStyle,
                marginTop: px(10),
                paddingLeft: px(6),
                paddingRight: px(6),
                fontSize: px(19 * density),
                lineHeight: 1.2,
              }}
            >
              {moment.title}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Lieux de la frise, sans doublon : nom en petites capitales, puis l'adresse. */
function Venues({
  moments,
  dx,
  palette,
  textStyle,
  smallCaps,
}: {
  moments: InvitationMoment[];
  dx: (value: number) => number;
  palette: Palette;
  textStyle: CSSProperties;
  smallCaps: string;
}) {
  const seen = new Set<string>();
  const venues = moments.filter((moment) => {
    const key = `${moment.venue}|${moment.address}`;
    if (!moment.venue && !moment.address) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (venues.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: dx(16), marginTop: dx(34) }}>
      {venues.map((moment, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {moment.venue && (
            <div style={{ ...textStyle, fontFamily: smallCaps, fontSize: dx(20), fontWeight: 500, color: palette.ink }}>
              {moment.venue}
            </div>
          )}
          {moment.address && (
            <div style={{ ...textStyle, marginTop: dx(2), fontSize: dx(17), opacity: 0.85 }}>{moment.address}</div>
          )}
        </div>
      ))}
    </div>
  );
}

import { z } from "zod";
import type { InspirationOption } from "./catalog";

/*
 * Identité visuelle du mariage : couleurs choisies par le couple, rôles et
 * accords calculés ici (théorie des couleurs en TypeScript, jamais par l'IA).
 */

export const hexColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/);

export const PALETTE_MAX_COLORS = 5;

/** Couleurs retenues par le couple, dans l'ordre d'importance. */
export const weddingPaletteSchema = z.object({
  colors: z.array(hexColorSchema).min(1).max(PALETTE_MAX_COLORS),
});
export type WeddingPalette = z.infer<typeof weddingPaletteSchema>;

/** Familles du nuancier, libellés dans Inspiration.palette.families.<key>. */
export const SWATCH_FAMILIES = ["greens", "earth", "romance", "blues", "light"] as const;
export type SwatchFamily = (typeof SWATCH_FAMILIES)[number];

/** Nuancier de mariage, libellés dans Inspiration.palette.swatches.<id>. */
export const WEDDING_SWATCHES = [
  { id: "sage", hex: "#8a9a82", family: "greens" },
  { id: "eucalyptus", hex: "#6f8f86", family: "greens" },
  { id: "olive", hex: "#7d7a4f", family: "greens" },
  { id: "emerald", hex: "#2f5d50", family: "greens" },
  { id: "terracotta", hex: "#b8613f", family: "earth" },
  { id: "rust", hex: "#9c4a2f", family: "earth" },
  { id: "caramel", hex: "#b98552", family: "earth" },
  { id: "sand", hex: "#d9c4a5", family: "earth" },
  { id: "blush", hex: "#e8c4bd", family: "romance" },
  { id: "dustyRose", hex: "#c48e8a", family: "romance" },
  { id: "coral", hex: "#e07a62", family: "romance" },
  { id: "burgundy", hex: "#6e2434", family: "romance" },
  { id: "dustyBlue", hex: "#8fa5b8", family: "blues" },
  { id: "lavender", hex: "#b3a6c9", family: "blues" },
  { id: "navy", hex: "#1f2d45", family: "blues" },
  { id: "plum", hex: "#5d3a55", family: "blues" },
  { id: "ivory", hex: "#f6f1e7", family: "light" },
  { id: "champagne", hex: "#e6d3b3", family: "light" },
  { id: "gold", hex: "#c2a15a", family: "light" },
  { id: "charcoal", hex: "#33312e", family: "light" },
] as const satisfies readonly { id: string; hex: string; family: SwatchFamily }[];
export type SwatchId = (typeof WEDDING_SWATCHES)[number]["id"];

const SWATCH_BY_HEX = new Map<string, SwatchId>(
  WEDDING_SWATCHES.map((swatch) => [swatch.hex, swatch.id]),
);
/** Nom du nuancier pour une couleur, s'il s'agit de l'une de ses teintes. */
export const swatchIdOf = (hex: string) => SWATCH_BY_HEX.get(hex) ?? null;
const swatch = (id: SwatchId) => WEDDING_SWATCHES.find((entry) => entry.id === id)!.hex;

/** Palettes prêtes à l'emploi, libellés dans Inspiration.palette.presets.<key>. */
export const PALETTE_PRESETS = {
  classicChateau: ["ivory", "champagne", "gold", "burgundy"],
  countryBoho: ["sage", "terracotta", "sand", "ivory"],
  seaside: ["dustyBlue", "sand", "ivory", "coral"],
  urbanChic: ["charcoal", "ivory", "blush", "gold"],
  romantic: ["blush", "dustyRose", "ivory", "sage"],
  starryNight: ["navy", "gold", "ivory", "dustyBlue"],
} as const satisfies Record<string, readonly SwatchId[]>;
export type PalettePreset = keyof typeof PALETTE_PRESETS;
export const PALETTE_PRESET_KEYS = Object.keys(PALETTE_PRESETS) as PalettePreset[];
export const presetColors = (preset: PalettePreset) => PALETTE_PRESETS[preset].map(swatch);

/** Palette la plus proche du lieu rêvé (swipes « lieu » du carnet). */
const PRESET_FOR_VENUE: Record<InspirationOption<"venue">, PalettePreset> = {
  chateau: "classicChateau",
  countryside: "countryBoho",
  beach: "seaside",
  urban: "urbanChic",
};

/** Palettes, celles qui correspondent aux lieux aimés en premier. */
export function orderedPresets(venues: readonly InspirationOption<"venue">[]): PalettePreset[] {
  const matching = [...new Set(venues.map((venue) => PRESET_FOR_VENUE[venue]))];
  return [...matching, ...PALETTE_PRESET_KEYS.filter((key) => !matching.includes(key))];
}

// --- Couleurs ---------------------------------------------------------------

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const toRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

function toHsl(hex: string): Hsl {
  const { r, g, b } = toRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
      : max === gn
        ? ((bn - rn) / d + 2) * 60
        : ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

/** Mélange linéaire de deux couleurs (ratio = part de b). */
export function mix(a: string, b: string, ratio: number): string {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex({
    r: x.r + (y.r - x.r) * ratio,
    g: x.g + (y.g - x.g) * ratio,
    b: x.b + (y.b - x.b) * ratio,
  });
}

function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}

/** Couleur neutre : peu saturée, très claire ou très foncée (ivoire, charbon…). */
const isNeutral = (hex: string) => {
  const { s, l } = toHsl(hex);
  return s < 0.18 || l > 0.86 || l < 0.16;
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const PAPER = "#faf8f4";
const INK = "#2b2a28";

export type PaletteRoles = {
  main: string;
  secondary: string;
  accent: string;
  /** Fonds, papeterie, nappes. */
  light: string;
  /** Textes, calligraphie. */
  deep: string;
};

/**
 * Rôles de la palette : la première couleur domine ; l'accent est la teinte
 * la plus contrastée parmi les autres ; clair et profond sont des neutres
 * teintés de la couleur principale, pour que tout reste dans la même famille.
 */
export function paletteRoles(colors: readonly string[]): PaletteRoles {
  const [main, ...rest] = colors;
  const mainHsl = toHsl(main);
  const colored = rest.filter((hex) => !isNeutral(hex));

  const accent =
    [...colored].sort(
      (a, b) => hueDistance(toHsl(b).h, mainHsl.h) - hueDistance(toHsl(a).h, mainHsl.h),
    )[0] ?? mix(main, isNeutral(main) ? "#c2a15a" : INK, 0.35);
  const secondary = rest.find((hex) => hex !== accent) ?? mix(main, PAPER, 0.45);

  return {
    main,
    secondary,
    accent,
    light: mix(main, PAPER, 0.9),
    deep: mix(main, INK, 0.78),
  };
}

/**
 * Teintes du nuancier qui s'accordent avec la couleur principale : voisines
 * (camaïeu), complémentaires (contraste doux) ou neutres. Ignore celles déjà
 * choisies.
 */
export function suggestSwatches(colors: readonly string[], count = 4): SwatchId[] {
  if (colors.length === 0) return [];
  const main = toHsl(colors[0]);
  const chosen = new Set(colors);
  return WEDDING_SWATCHES.filter((entry) => !chosen.has(entry.hex))
    .map((entry) => {
      const hsl = toHsl(entry.hex);
      const distance = hueDistance(hsl.h, main.h);
      const score = isNeutral(entry.hex)
        ? 0.6
        : distance >= 20 && distance <= 60
          ? 1
          : distance >= 150
            ? 0.85
            : 0.2;
      // Les teintes de même intensité se marient mieux.
      return { id: entry.id, score: score - Math.abs(hsl.s - main.s) * 0.3 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.id);
}

/** Le texte « profond » reste-t-il lisible sur le fond « clair » ? (WCAG AA) */
export const isReadable = (roles: PaletteRoles) => contrastRatio(roles.deep, roles.light) >= 4.5;

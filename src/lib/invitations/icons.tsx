import type { MomentIcon } from "./schema";

/*
 * Pictogrammes au trait des moments du programme, dans un repère 64 × 64.
 * SVG simple (path, circle, ellipse) pour rester compatible avec satori.
 */

const PATHS: Record<MomentIcon, string> = {
  // Fronton, colonnes et drapeau.
  cityhall:
    "M10 26 L32 13 L54 26 Z M14 26 V50 M24 26 V50 M40 26 V50 M50 26 V50 M8 50 H56 M6 55 H58 M32 13 V5 M32 5 H41 L38.5 8 L41 11 H32",
  // Nef, clocher et croix.
  church:
    "M8 56 H56 M12 56 V36 L25 26 L38 36 V56 M38 56 V26 L45 13 L52 26 V56 M45 13 V5 M42 8 H48 M21 56 V47 A4 4 0 0 1 29 47 V56 M45 34 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0",
  // Arche de cérémonie laïque, feuillage en couronne.
  arch:
    "M8 57 H56 M16 57 V30 A16 16 0 0 1 48 30 V57 M20 57 V30 A12 12 0 0 1 44 30 V57 M14 22 q-5 -1 -6 -6 q5 1 6 6 M50 22 q5 -1 6 -6 q-5 1 -6 6 M32 10 q-3 -4 0 -8 q3 4 0 8",
  // Deux flûtes qui trinquent.
  glass:
    "M17 8 L29 10 L26 28 A5 5 0 0 1 16 26.5 Z M21 29 L18 50 M12 51 H24 M47 8 L35 10 L38 28 A5 5 0 0 0 48 26.5 Z M43 29 L46 50 M40 51 H52 M32 4 V1 M27 5 L25 3 M37 5 L39 3",
  // Assiette, fourchette et couteau.
  dinner:
    "M32 34 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M32 34 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M8 16 V24 A3 3 0 0 0 14 24 V16 M11 16 V52 M56 16 V52 M56 16 C61 21 61 31 56 35",
  // Pièce montée à trois étages.
  cake:
    "M12 56 H52 M14 56 V44 H50 V56 M19 44 V34 H45 V44 M24 34 V25 H40 V34 M32 25 V18 M32 18 q-3 -4 0 -8 q3 4 0 8 M14 50 q4.5 3 9 0 t9 0 t9 0 t9 0",
  // Deux croches.
  music:
    "M24 46 V16 L48 10 V40 M24 22 L48 16 M19 46 m-5 0 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 M43 40 m-5 0 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0",
  // Tasse fumante et soucoupe.
  brunch:
    "M14 28 H44 V38 A12 12 0 0 1 32 50 H26 A12 12 0 0 1 14 38 Z M44 31 H48 A5 5 0 0 1 48 41 H43 M8 55 H52 M23 22 q-3 -4 0 -8 t0 -8 M32 22 q-3 -4 0 -8 t0 -8",
};

export function MomentIconSvg({
  icon,
  color,
  size,
}: {
  icon: MomentIcon;
  color: string;
  size: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path
        d={PATHS[icon]}
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

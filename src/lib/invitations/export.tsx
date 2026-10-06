import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import type { InvitationFamilies } from "./card";

/*
 * Rendu serveur des faire-part (PNG et PDF) : ImageResponse avec les polices
 * TTF embarquées dans assets/fonts (WOFF2 non pris en charge par satori).
 * Les routes qui l'utilisent doivent figurer dans outputFileTracingIncludes.
 */

// Polices lues une fois au chargement du module.
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const [
  playfair,
  cormorant,
  cormorantItalic,
  smallCaps,
  smallCapsMedium,
  pinyon,
  allison,
  jostLight,
  jost,
] = await Promise.all([
  font("PlayfairDisplay-Regular.ttf"),
  font("CormorantGaramond-Regular.ttf"),
  font("CormorantGaramond-Italic.ttf"),
  font("CormorantSC-Regular.ttf"),
  font("CormorantSC-Medium.ttf"),
  font("PinyonScript-Regular.ttf"),
  font("Allison-Regular.ttf"),
  font("Jost-Light.ttf"),
  font("Jost-Regular.ttf"),
]);

export const EXPORT_FAMILIES: InvitationFamilies = {
  playfair: "Playfair Display",
  cormorant: "Cormorant Garamond",
  smallCaps: "Cormorant SC",
  script: "Pinyon Script",
  signature: "Allison",
  sans: "Jost",
};

const FONTS = [
  { name: EXPORT_FAMILIES.playfair, data: playfair, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.cormorant, data: cormorant, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.cormorant, data: cormorantItalic, weight: 400, style: "italic" },
  { name: EXPORT_FAMILIES.smallCaps, data: smallCaps, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.smallCaps, data: smallCapsMedium, weight: 500, style: "normal" },
  { name: EXPORT_FAMILIES.script, data: pinyon, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.signature, data: allison, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.sans, data: jostLight, weight: 300, style: "normal" },
  { name: EXPORT_FAMILIES.sans, data: jost, weight: 400, style: "normal" },
] as const;

/** Réponse PNG d'un élément (styles en ligne, flexbox) aux dimensions données. */
export function renderPng(
  element: ReactElement,
  size: { width: number; height: number },
  headers?: Record<string, string>,
): ImageResponse {
  return new ImageResponse(element, { ...size, fonts: [...FONTS], headers });
}

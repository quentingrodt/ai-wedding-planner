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
const [playfair, cormorant, cormorantItalic, pinyon] = await Promise.all([
  font("PlayfairDisplay-Regular.ttf"),
  font("CormorantGaramond-Regular.ttf"),
  font("CormorantGaramond-Italic.ttf"),
  font("PinyonScript-Regular.ttf"),
]);

export const EXPORT_FAMILIES: InvitationFamilies = {
  playfair: "Playfair Display",
  cormorant: "Cormorant Garamond",
  script: "Pinyon Script",
};

const FONTS = [
  { name: EXPORT_FAMILIES.playfair, data: playfair, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.cormorant, data: cormorant, weight: 400, style: "normal" },
  { name: EXPORT_FAMILIES.cormorant, data: cormorantItalic, weight: 400, style: "italic" },
  { name: EXPORT_FAMILIES.script, data: pinyon, weight: 400, style: "normal" },
] as const;

/** Réponse PNG d'un élément (styles en ligne, flexbox) aux dimensions données. */
export function renderPng(
  element: ReactElement,
  size: { width: number; height: number },
  headers?: Record<string, string>,
): ImageResponse {
  return new ImageResponse(element, { ...size, fonts: [...FONTS], headers });
}

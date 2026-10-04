import { Cormorant_Garamond, Pinyon_Script } from "next/font/google";
import type { InvitationFamilies } from "@/lib/invitations/card";

// Polices propres aux faire-part (Playfair est déjà chargée par le layout).
const cormorant = Cormorant_Garamond({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap" });

/** Familles pour le rendu dans le navigateur. */
export const BROWSER_FAMILIES: InvitationFamilies = {
  playfair: "var(--font-playfair)",
  cormorant: cormorant.style.fontFamily,
  script: pinyon.style.fontFamily,
};

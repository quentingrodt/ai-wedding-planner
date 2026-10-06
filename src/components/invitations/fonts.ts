import { Allison, Cormorant_Garamond, Cormorant_SC, Jost, Pinyon_Script } from "next/font/google";
import type { InvitationFamilies } from "@/lib/invitations/card";

// Polices propres aux faire-part (Playfair est déjà chargée par le layout).
const cormorant = Cormorant_Garamond({
  weight: ["400", "500"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});
const cormorantSc = Cormorant_SC({ weight: ["400", "500"], subsets: ["latin"], display: "swap" });
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const allison = Allison({ weight: "400", subsets: ["latin"], display: "swap" });
const jost = Jost({ weight: ["300", "400"], subsets: ["latin"], display: "swap" });

/** Familles pour le rendu dans le navigateur. */
export const BROWSER_FAMILIES: InvitationFamilies = {
  playfair: "var(--font-playfair)",
  cormorant: cormorant.style.fontFamily,
  smallCaps: cormorantSc.style.fontFamily,
  script: pinyon.style.fontFamily,
  signature: allison.style.fontFamily,
  sans: jost.style.fontFamily,
};

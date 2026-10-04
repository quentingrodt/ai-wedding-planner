import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { CARD_RATIO, InvitationCard, type InvitationFamilies } from "@/lib/invitations/card";
import { getCurrentUserId, getCurrentWedding, getInvitation } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Largeur de l'image exportée : nette sur mobile et pour Instagram. */
const WIDTH = 1200;

// Polices lues une fois au chargement du module (TTF : WOFF2 non pris en charge).
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const [playfair, cormorant, cormorantItalic, pinyon] = await Promise.all([
  font("PlayfairDisplay-Regular.ttf"),
  font("CormorantGaramond-Regular.ttf"),
  font("CormorantGaramond-Italic.ttf"),
  font("PinyonScript-Regular.ttf"),
]);

const FAMILIES: InvitationFamilies = {
  playfair: "Playfair Display",
  cormorant: "Cormorant Garamond",
  script: "Pinyon Script",
};

/**
 * Faire-part enregistré du mariage courant, en PNG (WhatsApp, Instagram).
 * Gratuit, avec la mention « Créé avec Céleste » tant qu'il n'est pas
 * débloqué. Réservé aux membres du mariage (RLS d'invitations).
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const wedding = await getCurrentWedding(supabase);
  const invitation = wedding ? await getInvitation(supabase, wedding.id) : null;
  if (!invitation) {
    return new Response("Not found", { status: 404 });
  }

  const t = await getTranslations({ locale, namespace: "Invitations" });

  return new ImageResponse(
    (
      <InvitationCard
        design={invitation.design}
        width={WIDTH}
        families={FAMILIES}
        watermark={invitation.unlockedAt ? undefined : t("signature")}
      />
    ),
    {
      width: WIDTH,
      height: Math.round(WIDTH * CARD_RATIO),
      fonts: [
        { name: FAMILIES.playfair, data: playfair, weight: 400, style: "normal" },
        { name: FAMILIES.cormorant, data: cormorant, weight: 400, style: "normal" },
        { name: FAMILIES.cormorant, data: cormorantItalic, weight: 400, style: "italic" },
        { name: FAMILIES.script, data: pinyon, weight: 400, style: "normal" },
      ],
      headers: {
        "Content-Disposition": `attachment; filename="${t("download.fileName")}.png"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}

import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { CARD_RATIO, InvitationCard } from "@/lib/invitations/card";
import { EXPORT_FAMILIES, renderPng } from "@/lib/invitations/export";
import { getCurrentUserId, getCurrentWedding, getInvitation } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Largeur de l'image exportée : nette sur mobile et pour Instagram. */
const WIDTH = 1200;

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

  return renderPng(
    <InvitationCard
      design={invitation.design}
      width={WIDTH}
      families={EXPORT_FAMILIES}
      watermark={invitation.unlockedAt ? undefined : t("signature")}
    />,
    { width: WIDTH, height: Math.round(WIDTH * CARD_RATIO) },
    {
      "Content-Disposition": `attachment; filename="${t("download.fileName")}.png"`,
      "Cache-Control": "private, no-store",
    },
  );
}

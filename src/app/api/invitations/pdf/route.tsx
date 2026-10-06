import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import type { ReactElement } from "react";
import { routing } from "@/i18n/routing";
import { CARD_RATIO, InvitationBookletSpread, InvitationCard } from "@/lib/invitations/card";
import { EXPORT_FAMILIES, renderPng } from "@/lib/invitations/export";
import { bleedSizePx, buildPrintPdf, PRINT_FORMATS, type PrintFormat } from "@/lib/invitations/print";
import { INVITATION_PALETTES } from "@/lib/invitations/schema";
import { getCurrentUserId, getCurrentWedding, getInvitation } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

const isPrintFormat = (value: string | null): value is PrintFormat =>
  value !== null && Object.hasOwn(PRINT_FORMATS, value);

/**
 * Faire-part enregistré, en PDF prêt pour l'imprimeur (300 dpi, fond perdu
 * de 3 mm, traits de coupe). Carte simple : une face. Livret : deux faces de
 * feuille, extérieur (4e + couverture) puis intérieur (pages 2 et 3), avec
 * repères de pli. Tant qu'il n'est pas débloqué, c'est une épreuve marquée
 * « Épreuve » : la version finale suit le paiement (unlocked_at).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const requested = params.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const format = params.get("format");
  if (!isPrintFormat(format)) {
    return new Response("Bad request", { status: 400 });
  }

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
  const proof = invitation.unlockedAt === null;
  const { design } = invitation;
  const palette = INVITATION_PALETTES[design.palette];
  const panels = design.format === "booklet" ? 2 : 1;
  const size = bleedSizePx(format, panels);
  const pageHeight = Math.round(size.trimWidth * CARD_RATIO);
  const watermark = proof ? t("signature") : undefined;

  // Une face de feuille : le papier déborde de la coupe (fond perdu) ; les
  // pages sont centrées sur la zone de coupe (l'écart de proportion de l'A6,
  // < 1 mm, tombe dans la marge).
  const renderFace = (pages: ReactElement) =>
    renderPng(
      <div
        style={{
          position: "relative",
          display: "flex",
          width: size.width,
          height: size.height,
          backgroundColor: palette.paper,
        }}
      >
        <div
          style={{
            position: "absolute",
            display: "flex",
            left: size.bleed,
            top: size.bleed + Math.round((size.trimHeight - pageHeight) / 2),
          }}
        >
          {pages}
        </div>
        {proof && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                transform: "rotate(-32deg)",
                fontFamily: EXPORT_FAMILIES.playfair,
                fontSize: size.trimWidth / 5,
                letterSpacing: size.trimWidth / 60,
                textTransform: "uppercase",
                color: palette.ink,
                opacity: 0.1,
              }}
            >
              {t("print.proofMark")}
            </div>
          </div>
        )}
      </div>,
      { width: size.width, height: size.height },
    ).arrayBuffer();

  const props = { design, width: size.trimWidth, families: EXPORT_FAMILIES, watermark };
  const pngs = await Promise.all(
    design.format === "booklet"
      ? [
          renderFace(<InvitationBookletSpread {...props} pages={["back", "cover"]} />),
          renderFace(<InvitationBookletSpread {...props} pages={["inside-left", "inside-right"]} />),
        ]
      : [renderFace(<InvitationCard {...props} />)],
  );

  const pdf = await buildPrintPdf({
    pngs,
    format,
    panels,
    title: t("print.documentTitle", { names: design.content.names }),
  });

  const suffix = proof ? `-${t("print.proofMark").toLowerCase()}` : "";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${t("print.fileName")}-${format}${suffix}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

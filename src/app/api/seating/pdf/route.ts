import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildSeatingListing } from "@/lib/seating/listing";
import { buildSeatingPdf } from "@/lib/seating/pdf";
import { isoDateToUtc } from "@/lib/weddings/dates";
import {
  getConfirmedGuests,
  getCurrentUserId,
  getCurrentWedding,
  getSeatingTables,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/**
 * Plan de table en PDF : tables et invités, index alphabétique, récapitulatif
 * traiteur. Ouvert à tous les membres du mariage (lecture sous RLS).
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return new Response("Not found", { status: 404 });
  }

  const [tables, guests, t, format] = await Promise.all([
    getSeatingTables(supabase, wedding.id),
    getConfirmedGuests(supabase, wedding.id),
    getTranslations({ locale, namespace: "Seating.pdf" }),
    getFormatter({ locale }),
  ]);
  const listing = buildSeatingListing(tables, guests, locale);
  const names = wedding.title;

  const pdf = await buildSeatingPdf(listing, {
    documentTitle: t("documentTitle", { names }),
    eyebrow: t("eyebrow"),
    title: names,
    subtitle: wedding.wedding_date
      ? format.dateTime(isoDateToUtc(wedding.wedding_date), {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : null,
    summary: t("summary", {
      tables: listing.tables.length,
      seated: listing.totals.seated,
      guests: listing.totals.guests,
      children: listing.totals.children,
      diets: listing.totals.diets,
    }),
    tablesTitle: t("tablesTitle"),
    seats: (seated, capacity) => t("seats", { seated, capacity }),
    emptyTable: t("emptyTable"),
    child: t("child"),
    noTables: t("noTables"),
    unseatedTitle: t("unseatedTitle"),
    indexTitle: t("indexTitle"),
    toSeat: t("toSeat"),
    catererTitle: t("catererTitle"),
    columns: {
      table: t("columns.table"),
      guests: t("columns.guests"),
      adults: t("columns.adults"),
      children: t("columns.children"),
      diets: t("columns.diets"),
    },
    total: t("total"),
    dietsTitle: t("dietsTitle"),
    noDiets: t("noDiets"),
    footer: t("footer", { names }),
    page: (current, total) => t("page", { current, total }),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${t("fileName")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

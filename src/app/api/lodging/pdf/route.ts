import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildLodgingListing } from "@/lib/lodging/listing";
import { buildLodgingPdf } from "@/lib/lodging/pdf";
import { isoDateToUtc } from "@/lib/weddings/dates";
import {
  getCurrentUserId,
  getCurrentWedding,
  getGuestFamilies,
  getLodging,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/**
 * Répartition des hébergements en PDF : chaque hébergement avec toutes ses
 * informations et qui y dort, les invités encore à loger, l'index « qui dort
 * où ». Ouvert à tous les membres du mariage (lecture sous RLS).
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

  const [{ guests, lodgings }, families, t, tLodging, format] = await Promise.all([
    getLodging(supabase, wedding.id),
    getGuestFamilies(supabase, wedding.id),
    getTranslations({ locale, namespace: "Lodging.pdf" }),
    getTranslations({ locale, namespace: "Lodging" }),
    getFormatter({ locale }),
  ]);
  const listing = buildLodgingListing(lodgings, guests, families, locale);
  const names = wedding.title;
  const date = (iso: string, withWeekday = false) =>
    format.dateTime(isoDateToUtc(iso), {
      ...(withWeekday && { weekday: "long" }),
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency: wedding.currency_code, maximumFractionDigits: 0 });

  const pdf = await buildLodgingPdf(listing, {
    documentTitle: t("documentTitle", { names }),
    eyebrow: t("eyebrow"),
    title: names,
    subtitle: wedding.wedding_date ? date(wedding.wedding_date, true) : null,
    summary:
      listing.totals.people === 0
        ? t("summaryNone")
        : t("summary", {
            people: listing.totals.people,
            assigned: listing.totals.assigned,
            lodgings: listing.totals.lodgings,
            unassigned: listing.totals.unassigned,
          }),
    lodgingsTitle: t("lodgingsTitle"),
    noLodgings: t("noLodgings"),
    kindStatus: (lodging) => `${tLodging(`kinds.${lodging.kind}`)} · ${tLodging(`statuses.${lodging.status}`)}`,
    occupancy: (people, rooms, planned) =>
      planned === null ? t("occupancyHosted", { people }) : t("occupancy", { people, rooms, planned }),
    facts: {
      travel: (minutes) => tLodging("facts.travel", { minutes }),
      perNight: (price) => tLodging("facts.perNight", { price: money(price) }),
      rooms: (count) => t("roomsHeld", { count }),
      groupRate: tLodging("facts.groupRate"),
      code: t("labels.code"),
      deadline: t("labels.deadline"),
      contact: t("labels.contact"),
      url: t("labels.url"),
      notes: t("labels.notes"),
    },
    date: (iso) => date(iso),
    residentsTitle: t("residentsTitle"),
    nobody: t("nobody"),
    child: t("child"),
    unassignedTitle: t("unassignedTitle"),
    unassignedLead: t("unassignedLead"),
    indexTitle: t("indexTitle"),
    toHost: t("toHost"),
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

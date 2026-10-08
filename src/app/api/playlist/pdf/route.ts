import { hasLocale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildPlaylistPdf } from "@/lib/playlist/pdf";
import {
  durationParts,
  formatTrackDuration,
  groupBySection,
  playlistDuration,
} from "@/lib/playlist/schema";
import { isoDateToUtc } from "@/lib/weddings/dates";
import { getCurrentUserId, getCurrentWedding, getWeddingPlaylist } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/**
 * Playlist pour le DJ en PDF : morceaux validés moment par moment, puis
 * « à ne pas passer ». Ouvert à tous les membres du mariage (lecture sous RLS).
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

  const [tracks, t, format] = await Promise.all([
    getWeddingPlaylist(supabase, wedding.id),
    getTranslations({ locale, namespace: "Playlist" }),
    getFormatter({ locale }),
  ]);
  const groups = groupBySection(tracks);
  const count = groups.filter((group) => group.section !== "do_not_play").reduce((sum, group) => sum + group.tracks.length, 0);
  const duration = durationParts(playlistDuration(tracks));
  const names = wedding.title;

  const pdf = await buildPlaylistPdf({
    documentTitle: t("pdf.documentTitle", { names }),
    eyebrow: t("pdf.eyebrow"),
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
    summary: t("pdf.summary", {
      count,
      duration:
        duration.hours > 0
          ? t("list.hours", duration)
          : t("list.minutes", { minutes: Number(duration.minutes) }),
    }),
    empty: t("pdf.empty"),
    footer: t("pdf.footer"),
    page: (current, total) => t("pdf.page", { current, total }),
    groups: groups.map((group) => ({
      label: t(`sections.${group.section}`),
      avoid: group.section === "do_not_play",
      note: group.section === "do_not_play" ? t("pdf.doNotPlay") : null,
      tracks: group.tracks.map((track) => ({
        name: track.name,
        artist: track.artist,
        duration: track.duration_ms === null ? null : formatTrackDuration(track.duration_ms),
      })),
    })),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${t("pdf.fileName")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

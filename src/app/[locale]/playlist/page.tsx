import { ArrowLeftIcon, ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Link, redirect } from "@/i18n/navigation";
import type { ConnectStatus } from "@/lib/spotify/oauth";
import type { PlaylistTracks } from "@/lib/spotify/schema";
import { getPlaylistTracks, getSpotifyIntegration, SpotifyError } from "@/lib/spotify/server";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { DisconnectButton } from "./_components/disconnect-button";
import { PlaylistSearch } from "./_components/playlist-search";
import { PlaylistTrackList } from "./_components/playlist-track-list";
import { RecordIllustration } from "./_components/record-illustration";

const CONNECT_STATUSES = ["connected", "denied", "error", "forbidden"] as const;
const isConnectStatus = (value: unknown): value is ConnectStatus =>
  CONNECT_STATUSES.includes(value as ConnectStatus);

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/playlist">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Playlist" });
  return { title: t("metaTitle") };
}

export default async function PlaylistPage({
  params,
  searchParams,
}: PageProps<"/[locale]/playlist">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }

  const [role, t, { spotify }] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getTranslations("Playlist"),
    searchParams,
  ]);
  const canEdit = role === "owner" || role === "partner";
  const status = isConnectStatus(spotify) ? spotify : null;

  // Lecture serveur (service_role) : seul l'identifiant de playlist sort d'ici.
  // Sans clé service_role configurée, la page reste sur l'invitation à connecter.
  let integration = await getSpotifyIntegration(wedding.id).catch((error: unknown) => {
    console.error("[spotify] page:", error instanceof Error ? error.message : "unknown");
    return null;
  });

  // Morceaux lus à chaque affichage depuis l'API (source de vérité). Accès retiré
  // depuis Spotify : la liaison vient d'être supprimée, on repropose de connecter.
  let playlist: PlaylistTracks = null;
  if (integration?.playlistId) {
    try {
      playlist = await getPlaylistTracks(wedding.id, integration.playlistId);
    } catch (error) {
      if (error instanceof SpotifyError && error.code === "disconnected") integration = null;
    }
  }

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-stone transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {t("back")}
          </Link>
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        {status && status !== "connected" && (
          <p role="status" className="rounded-3xl bg-terracotta-soft/60 px-6 py-4 text-charcoal">
            {t(`status.${status}`)}
          </p>
        )}

        {!integration ? (
          <section
            aria-labelledby="connect-title"
            className="flex flex-col items-center gap-6 rounded-3xl bg-linen px-6 py-14 text-center sm:px-12"
          >
            <RecordIllustration className="w-32 sm:w-36" />
            <div className="flex max-w-md flex-col gap-3">
              <h2 id="connect-title" className="font-serif text-3xl text-balance">
                {t("empty.title")}
              </h2>
              <p className="text-pretty text-stone">{t("empty.body")}</p>
            </div>
            {canEdit ? (
              // Route API (redirection OAuth) : lien classique, pas de navigation client.
              <a
                href={`/api/spotify/login?locale=${locale}`}
                className="inline-flex h-12 items-center rounded-full bg-sage-deep px-7 text-base text-ivory transition-colors hover:bg-charcoal"
              >
                {t("empty.connect")}
              </a>
            ) : (
              <p className="text-sm text-stone">{t("empty.readOnly")}</p>
            )}
            <p className="max-w-sm text-xs text-stone">{t("empty.privacy")}</p>
          </section>
        ) : (
          <section aria-labelledby="search-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="search-title" className="font-serif text-3xl">
                {status === "connected" ? t("connected.welcome") : t("connected.title")}
              </h2>
              <div className="flex items-center gap-1">
                {integration.playlistId && (
                  <a
                    href={`https://open.spotify.com/playlist/${integration.playlistId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-sage-deep transition-colors hover:bg-sage-soft"
                  >
                    {t("connected.open")}
                    <ArrowUpRightIcon aria-hidden className="size-4" />
                  </a>
                )}
                {canEdit && <DisconnectButton />}
              </div>
            </div>
            {canEdit ? (
              <PlaylistSearch weddingId={wedding.id} initialPlaylist={playlist} />
            ) : (
              <div className="flex flex-col gap-6">
                <p className="text-stone">{t("connected.readOnly")}</p>
                <div className="max-w-xl">
                  <PlaylistTrackList playlist={playlist} />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

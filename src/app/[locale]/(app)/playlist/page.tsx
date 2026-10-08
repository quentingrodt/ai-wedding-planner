import { ArrowUpRightIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import type { ConnectStatus } from "@/lib/spotify/oauth";
import { getSpotifyIntegration } from "@/lib/spotify/server";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getWeddingPlaylist,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { CatalogSearch } from "./_components/catalog-search";
import { DisconnectButton } from "./_components/disconnect-button";
import { PlaylistList } from "./_components/playlist-list";
import { RecordIllustration } from "./_components/record-illustration";
import { SendToSpotifyButton } from "./_components/send-to-spotify-button";

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

/**
 * Playlist du mariage, tenue dans Céleste : recherche dans le catalogue
 * Spotify sans compte, morceaux rangés par moment. Lier un compte Spotify
 * reste facultatif et ne sert qu'à envoyer la liste dans Spotify.
 */
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

  const [role, tracks, t, { spotify }] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getWeddingPlaylist(supabase, wedding.id),
    getTranslations("Playlist"),
    searchParams,
  ]);
  const canManage = role === "owner" || role === "partner";
  const status = isConnectStatus(spotify) ? spotify : null;

  // Liaison Spotify (mariés seulement, lecture service_role) : seul l'identifiant
  // de playlist sort d'ici. Sans clé service_role, la carte propose de connecter.
  const integration = canManage
    ? await getSpotifyIntegration(wedding.id).catch((error: unknown) => {
        console.error("[spotify] page:", error instanceof Error ? error.message : "unknown");
        return null;
      })
    : null;

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {/* Route API (fichier téléchargé) : lien classique, pas de navigation client. */}
          <a
            href={`/api/playlist/pdf?locale=${locale}`}
            download
            title={t("exportHint")}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-linen px-5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sage-soft"
          >
            <DownloadIcon aria-hidden className="size-4" />
            {t("export")}
          </a>
        </header>

        {status && status !== "connected" && (
          <p role="status" className="rounded-3xl bg-terracotta-soft/60 px-6 py-4 text-charcoal">
            {t(`status.${status}`)}
          </p>
        )}

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-10">
          <CatalogSearch
            canManage={canManage}
            inPlaylist={new Set(tracks.map((track) => track.spotify_id))}
          />
          <aside className="flex flex-col gap-6 lg:sticky lg:top-8">
            <PlaylistList tracks={tracks} canManage={canManage} userId={userId} />

            {canManage && (
              <section
                aria-labelledby="spotify-title"
                className="flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1 ring-border"
              >
                <div className="flex items-start gap-4">
                  <RecordIllustration className="w-14 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 id="spotify-title" className="font-serif text-lg leading-snug">
                      {t("spotify.title")}
                    </h2>
                    <p className="text-sm text-pretty text-stone">
                      {integration ? t("spotify.connectedBody") : t("spotify.body")}
                    </p>
                  </div>
                </div>

                {integration ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1">
                      <SendToSpotifyButton />
                      {integration.playlistId && (
                        <a
                          href={`https://open.spotify.com/playlist/${integration.playlistId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-sage-deep transition-colors hover:bg-sage-soft"
                        >
                          {t("spotify.open")}
                          <ArrowUpRightIcon aria-hidden className="size-4" />
                        </a>
                      )}
                      <DisconnectButton />
                    </div>
                    <p className="text-xs text-pretty text-stone">{t("spotify.note")}</p>
                  </>
                ) : (
                  <>
                    {/* Route API (redirection OAuth) : lien classique, pas de navigation client. */}
                    <a
                      href={`/api/spotify/login?locale=${locale}`}
                      className="inline-flex h-10 w-fit items-center rounded-full bg-sage-deep px-5 text-sm text-ivory transition-colors hover:bg-charcoal"
                    >
                      {t("spotify.connect")}
                    </a>
                    <p className="text-xs text-pretty text-stone">{t("spotify.privacy")}</p>
                  </>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

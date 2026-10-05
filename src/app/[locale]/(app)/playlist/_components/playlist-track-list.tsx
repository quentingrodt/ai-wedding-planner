"use client";

import { MusicIcon, PauseIcon, PlayIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaylistTracks } from "@/lib/spotify/schema";
import { cn } from "@/lib/utils";
import { PLAYER_HEIGHT, useSpotifyPlayer } from "./use-spotify-player";

/** Durée Spotify (ms) en « 3:27 ». */
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Morceaux de la playlist du mariage, lus depuis l'API Spotify, avec écoute par morceau. */
export function PlaylistTrackList({ playlist }: { playlist: PlaylistTracks }) {
  const t = useTranslations("Playlist.tracks");
  const { host, currentUri, isPaused, failed, toggle } = useSpotifyPlayer();

  return (
    <section
      aria-labelledby="playlist-tracks-title"
      className="flex flex-col gap-4 rounded-3xl bg-linen p-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3 id="playlist-tracks-title" className="font-serif text-2xl">
          {t("title")}
        </h3>
        {playlist && (
          <span className="text-sm text-stone tabular-nums">
            {t("count", { count: playlist.total })}
          </span>
        )}
      </header>

      {/* Lecteur compact, créé au premier « écouter » ; Spotify y insère son iframe. */}
      <div
        className={cn("relative overflow-hidden rounded-xl", !currentUri && "hidden")}
        style={{ height: PLAYER_HEIGHT }}
      >
        <Skeleton aria-hidden className="absolute inset-0 rounded-xl bg-sand/50" />
        <div ref={host} className="relative" />
      </div>
      {failed && <p className="text-sm text-terracotta">{t("playerError")}</p>}

      {playlist === null ? (
        <p className="text-sm text-stone">{t("error")}</p>
      ) : playlist.tracks.length === 0 ? (
        <p className="text-sm text-pretty text-stone">{t("empty")}</p>
      ) : (
        <ol className="-mx-1 flex max-h-[28rem] flex-col overflow-y-auto px-1 lg:max-h-[calc(100dvh-12rem)]">
          {playlist.tracks.map((track, index) => {
            const current = currentUri === track.uri;
            const playing = current && !isPaused;
            return (
              <li
                key={`${track.id}-${index}`}
                className="group flex items-center gap-3 border-b border-sand py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => toggle(track.uri)}
                  aria-pressed={playing}
                  aria-label={
                    playing
                      ? t("pause", { name: track.name })
                      : t("play", { name: track.name, artist: track.artist })
                  }
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    current
                      ? "bg-sage text-ivory hover:bg-sage-deep"
                      : "text-stone hover:bg-sage-soft hover:text-sage-deep",
                  )}
                >
                  {playing ? (
                    <PauseIcon aria-hidden className="size-3.5 fill-current" />
                  ) : (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          "text-xs tabular-nums group-hover:hidden",
                          current && "hidden",
                        )}
                      >
                        {index + 1}
                      </span>
                      <PlayIcon
                        aria-hidden
                        className={cn(
                          "size-3.5 fill-current",
                          !current && "hidden group-hover:block",
                        )}
                      />
                    </>
                  )}
                </button>
                <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand/60">
                  {track.cover_url ? (
                    <Image
                      src={track.cover_url}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <MusicIcon aria-hidden className="size-4 text-stone" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-charcoal">{track.name}</span>
                  <span className="truncate text-xs text-stone">{track.artist}</span>
                </span>
                {track.duration_ms !== null && (
                  <span className="shrink-0 text-xs text-stone tabular-nums">
                    {formatDuration(track.duration_ms)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

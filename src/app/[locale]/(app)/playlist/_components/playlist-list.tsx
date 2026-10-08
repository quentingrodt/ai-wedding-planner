"use client";

import { CheckIcon, EllipsisIcon, MusicIcon, PauseIcon, PlayIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { approveTrack, moveTrack, removeTrack } from "@/lib/playlist/actions";
import {
  durationParts,
  formatTrackDuration,
  groupBySection,
  PLAYLIST_SECTIONS,
  playlistDuration,
  type PlaylistError,
  type PlaylistTrack,
} from "@/lib/playlist/schema";
import { cn } from "@/lib/utils";
import { PLAYER_HEIGHT, useSpotifyPlayer } from "./use-spotify-player";

/** État de lecture transmis aux lignes (sans la ref du lecteur). */
type Player = { currentUri: string | null; isPaused: boolean; toggle: (uri: string) => void };

/** Passe une action et affiche son message, ou l'erreur. */
function useTrackAction() {
  const t = useTranslations("Playlist");
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: true } | { ok: false; error: PlaylistError }>, success: string) =>
    startTransition(async () => {
      const result = await action().catch(() => ({ ok: false as const, error: "generic" as const }));
      if (result.ok) toast(success);
      else toast.error(t(`errors.${result.error}`));
    });
  return { pending, run };
}

/**
 * La playlist moment par moment, avec écoute par morceau (lecteur Spotify
 * intégré, sans compte) et, au-dessus, les propositions des témoins.
 */
export function PlaylistList({
  tracks,
  canManage,
  userId,
}: {
  tracks: PlaylistTrack[];
  canManage: boolean;
  userId: string;
}) {
  const t = useTranslations("Playlist");
  const { host, currentUri, isPaused, failed, toggle } = useSpotifyPlayer();
  const player: Player = { currentUri, isPaused, toggle };
  const groups = groupBySection(tracks);
  const approvedCount = groups.reduce((sum, group) => sum + group.tracks.length, 0);
  const duration = durationParts(playlistDuration(tracks));
  // Les mariés voient toutes les propositions ; un témoin, les siennes.
  const suggestions = tracks.filter(
    (track) => track.status === "suggested" && (canManage || track.created_by === userId),
  );

  return (
    <section aria-labelledby="playlist-title" className="flex flex-col gap-5 rounded-3xl bg-linen p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="playlist-title" className="font-serif text-2xl">
          {t("list.title")}
        </h2>
        <span className="text-sm text-stone tabular-nums">
          {t("list.count", { count: approvedCount })}
          {approvedCount > 0 &&
            ` · ${t("list.duration", {
              duration:
                duration.hours > 0
                  ? t("list.hours", duration)
                  : t("list.minutes", { minutes: Number(duration.minutes) }),
            })}`}
        </span>
      </header>

      {/* Lecteur compact, créé au premier « écouter » ; Spotify y insère son iframe. */}
      <div
        className={cn("relative overflow-hidden rounded-xl", !currentUri && "hidden")}
        style={{ height: PLAYER_HEIGHT }}
      >
        <Skeleton aria-hidden className="absolute inset-0 rounded-xl bg-sand/50" />
        <div ref={host} className="relative" />
      </div>
      {failed &&<p className="text-sm text-terracotta">{t("list.playerError")}</p>}

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-sand">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-serif text-lg">
              {canManage ? t("suggestions.title") : t("suggestions.titleWitness")}
            </h3>
            <p className="text-sm text-stone">
              {canManage ? t("suggestions.lead") : t("suggestions.leadWitness")}
            </p>
          </div>
          <ul className="flex flex-col">
            {suggestions.map((track) => (
              <SuggestionRow key={track.id} track={track} canManage={canManage} player={player} />
            ))}
          </ul>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-pretty text-stone">{canManage ? t("list.empty") : t("list.emptyWitness")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.section} className="flex flex-col gap-1">
              <h3
                className={cn(
                  "text-xs font-medium tracking-[0.2em] uppercase",
                  group.section === "do_not_play" ? "text-terracotta" : "text-sage-deep",
                )}
              >
                {t(`sections.${group.section}`)}
              </h3>
              <ol className="flex flex-col">
                {group.tracks.map((track) => (
                  <TrackRow key={track.id} track={track} canManage={canManage} player={player} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayButton({ track, player }: { track: PlaylistTrack; player: Player }) {
  const t = useTranslations("Playlist.list");
  const uri = `spotify:track:${track.spotify_id}`;
  const current = player.currentUri === uri;
  const playing = current && !player.isPaused;
  return (
    <button
      type="button"
      onClick={() => player.toggle(uri)}
      aria-pressed={playing}
      aria-label={playing ? t("pause", { name: track.name }) : t("play", { name: track.name, artist: track.artist })}
      className={cn(
        "group/play relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sand/60",
      )}
    >
      {track.cover_url ? (
        <Image src={track.cover_url} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <MusicIcon aria-hidden className="size-4 text-stone" />
      )}
      {/* Voile de lecture : au survol, ou en permanence sur le morceau en cours. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-charcoal/45 text-ivory transition-opacity",
          current ? "opacity-100" : "opacity-0 group-hover/play:opacity-100 group-focus-visible/play:opacity-100",
        )}
      >
        {playing ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
      </span>
    </button>
  );
}

function TrackRow({ track, canManage, player }: { track: PlaylistTrack; canManage: boolean; player: Player }) {
  const t = useTranslations("Playlist");
  const { pending, run } = useTrackAction();

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-sand py-2.5 transition-opacity last:border-b-0",
        pending && "opacity-50",
      )}
    >
      <PlayButton track={track} player={player} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-charcoal">{track.name}</span>
        <span className="truncate text-xs text-stone">{track.artist}</span>
      </span>
      {track.duration_ms !== null && (
        <span className="shrink-0 text-xs text-stone tabular-nums">{formatTrackDuration(track.duration_ms)}</span>
      )}
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            aria-label={t("list.actions", { name: track.name })}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone transition-colors hover:bg-sage-soft hover:text-sage-deep focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <EllipsisIcon aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
            <DropdownMenuLabel className="px-2.5 text-xs font-normal text-stone">{t("list.move")}</DropdownMenuLabel>
            {PLAYLIST_SECTIONS.filter((section) => section !== track.section).map((section) => (
              <DropdownMenuItem
                key={section}
                className="rounded-xl px-2.5 py-2"
                onSelect={() =>
                  run(() => moveTrack(track.id, section), `${track.name} · ${t(`sections.${section}`)}`)
                }
              >
                {t(`sections.${section}`)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 rounded-xl px-2.5 py-2 text-terracotta"
              onSelect={() => run(() => removeTrack(track.id), t("list.removed", { name: track.name }))}
            >
              <Trash2Icon aria-hidden className="size-4" />
              {t("list.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function SuggestionRow({ track, canManage, player }: { track: PlaylistTrack; canManage: boolean; player: Player }) {
  const t = useTranslations("Playlist");
  const { pending, run } = useTrackAction();
  const iconButton =
    "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

  return (
    <li className={cn("flex items-center gap-3 py-2 transition-opacity", pending && "opacity-50")}>
      <PlayButton track={track} player={player} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-charcoal">{track.name}</span>
        <span className="truncate text-xs text-stone">
          {track.artist} · {t("suggestions.for", { section: t(`sections.${track.section}`) })}
        </span>
      </span>
      {canManage && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveTrack(track.id), t("suggestions.approved", { name: track.name }))}
          aria-label={t("suggestions.approve", { name: track.name })}
          className={cn(iconButton, "bg-sage text-ivory hover:bg-sage-deep")}
        >
          <CheckIcon aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => removeTrack(track.id),
            canManage ? t("suggestions.declined", { name: track.name }) : t("list.removed", { name: track.name }),
          )
        }
        aria-label={
          canManage ? t("suggestions.decline", { name: track.name }) : t("suggestions.withdraw", { name: track.name })
        }
        className={cn(iconButton, "text-stone hover:bg-terracotta-soft hover:text-terracotta")}
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </li>
  );
}

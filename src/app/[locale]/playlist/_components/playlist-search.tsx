"use client";

import { CheckIcon, MusicIcon, PlusIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { addToPlaylist, searchSpotify } from "@/lib/spotify/actions";
import {
  SPOTIFY_QUERY_MAX,
  type PlaylistTracks,
  type SpotifyActionError,
  type SpotifyTrack,
} from "@/lib/spotify/schema";
import { cn } from "@/lib/utils";
import { PlaylistTrackList } from "./playlist-track-list";

/** Pause après la dernière frappe avant d'interroger Spotify. */
const DEBOUNCE_MS = 350;

/** Recherche Spotify au fil de la frappe, ajout en un clic, et morceaux de la playlist. */
export function PlaylistSearch({
  weddingId,
  initialPlaylist,
}: {
  weddingId: string;
  /** Lue côté serveur à l'affichage de la page ; null si Spotify n'a pas répondu. */
  initialPlaylist: PlaylistTracks;
}) {
  const t = useTranslations("Playlist");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[] | null>(null);
  const [error, setError] = useState<SpotifyActionError | null>(null);
  // Un ajout confirmé par Spotify s'affiche aussitôt, sans relire la playlist.
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [added, setAdded] = useState<ReadonlySet<string>>(
    () => new Set(initialPlaylist?.tracks.map((track) => track.uri)),
  );
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Seule la réponse à la dernière recherche lancée est affichée.
  const latest = useRef(0);

  // Accès retiré depuis Spotify : la page repasse sur l'invitation à reconnecter.
  function handleError(code: SpotifyActionError) {
    if (code === "disconnected") {
      router.refresh();
      return;
    }
    toast.error(t(`errors.${code}`));
  }

  function search(value: string) {
    const id = ++latest.current;
    startSearch(async () => {
      const result = await searchSpotify(value);
      if (id !== latest.current) return;
      if (result.ok) {
        setTracks(result.tracks);
        setError(null);
      } else {
        setError(result.error);
        if (result.error === "disconnected") handleError(result.error);
      }
    });
  }

  function change(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    if (value.trim() === "") {
      latest.current++;
      setTracks(null);
      setError(null);
      return;
    }
    timer.current = setTimeout(() => search(value), DEBOUNCE_MS);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearTimeout(timer.current);
    if (query.trim() !== "") search(query);
  }

  function markAdded(track: SpotifyTrack) {
    setAdded((current) => new Set(current).add(track.uri));
    setPlaylist(
      (current) => current && { total: current.total + 1, tracks: [...current.tracks, track] },
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-6">
        <form role="search" onSubmit={submit} className="relative w-full">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-stone"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => change(event.target.value)}
            maxLength={SPOTIFY_QUERY_MAX}
            aria-label={t("search.label")}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            className="h-14 rounded-full bg-card pr-5 pl-13 text-base shadow-[0_18px_40px_-28px_rgba(43,42,40,0.45)]"
          />
        </form>

        <div aria-live="polite" aria-busy={searching}>
          {searching && tracks === null ? (
            <ul className="flex flex-col gap-2" aria-label={t("search.loading")}>
              {Array.from({ length: 5 }, (_, index) => (
                <li key={index} className="flex items-center gap-4 rounded-2xl bg-linen/70 p-3">
                  <Skeleton className="size-14 rounded-xl bg-sand/60" />
                  <span className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3 bg-sand/60" />
                    <Skeleton className="h-3 w-1/3 bg-sand/50" />
                  </span>
                </li>
              ))}
            </ul>
          ) : error && error !== "disconnected" ? (
            <p className="rounded-3xl bg-terracotta-soft/60 px-6 py-5 text-center text-charcoal">
              {t(`errors.${error}`)}
            </p>
          ) : tracks === null ? (
            <p className="text-pretty text-stone">{t("search.hint")}</p>
          ) : tracks.length === 0 ? (
            <p className="rounded-3xl bg-linen px-6 py-8 text-center text-stone">
              {t("search.noResults", { query: query.trim() })}
            </p>
          ) : (
            <ul
              className={cn(
                "flex flex-col gap-2 transition-opacity duration-300",
                searching && "opacity-60",
              )}
            >
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  weddingId={weddingId}
                  added={added.has(track.uri)}
                  onAdded={markAdded}
                  onError={handleError}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <aside className="lg:sticky lg:top-8">
        <PlaylistTrackList playlist={playlist} />
      </aside>
    </div>
  );
}

function TrackRow({
  track,
  weddingId,
  added,
  onAdded,
  onError,
}: {
  track: SpotifyTrack;
  weddingId: string;
  added: boolean;
  onAdded: (track: SpotifyTrack) => void;
  onError: (code: SpotifyActionError) => void;
}) {
  const t = useTranslations("Playlist");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addToPlaylist(weddingId, track.uri);
      if (!result.ok) {
        onError(result.error);
        return;
      }
      onAdded(track);
      toast(t("add.success", { name: track.name }));
    });
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl bg-linen/70 p-3 pr-4 transition-colors hover:bg-linen">
      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sand/60">
        {track.cover_url ? (
          <Image src={track.cover_url} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <MusicIcon aria-hidden className="size-5 text-stone" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base text-charcoal">{track.name}</span>
        <span className="truncate text-sm text-stone">{track.artist}</span>
      </span>
      <Button
        type="button"
        size="icon"
        onClick={add}
        disabled={pending || added}
        aria-label={
          added
            ? t("add.done", { name: track.name })
            : t("add.trigger", { name: track.name, artist: track.artist })
        }
        className={cn(
          "size-10 shrink-0 rounded-full transition-colors",
          added
            ? "bg-sage-soft text-sage-deep disabled:opacity-100"
            : "bg-sage text-ivory hover:bg-sage-deep",
          pending && "animate-pulse",
        )}
      >
        {added ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
      </Button>
    </li>
  );
}

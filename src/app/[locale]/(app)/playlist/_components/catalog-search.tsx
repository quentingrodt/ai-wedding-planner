"use client";

import { CheckIcon, MusicIcon, PlusIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { addTrack, searchCatalogTracks } from "@/lib/playlist/actions";
import {
  DEFAULT_SECTION,
  PLAYLIST_SECTIONS,
  type CatalogTrack,
  type PlaylistError,
  type PlaylistSection,
} from "@/lib/playlist/schema";
import { SPOTIFY_QUERY_MAX } from "@/lib/spotify/schema";
import { cn } from "@/lib/utils";

/** Pause après la dernière frappe avant d'interroger le catalogue. */
const DEBOUNCE_MS = 350;

/**
 * Recherche dans le catalogue Spotify (sans compte), puis ajout en un clic
 * dans le moment choisi. Un témoin propose au lieu d'ajouter.
 */
export function CatalogSearch({
  canManage,
  inPlaylist,
}: {
  canManage: boolean;
  /** Identifiants Spotify déjà dans la playlist (validés ou proposés). */
  inPlaylist: ReadonlySet<string>;
}) {
  const t = useTranslations("Playlist");
  const sectionId = useId();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<PlaylistSection>(DEFAULT_SECTION);
  const [tracks, setTracks] = useState<CatalogTrack[] | null>(null);
  const [error, setError] = useState<PlaylistError | null>(null);
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Seule la réponse à la dernière recherche lancée est affichée.
  const latest = useRef(0);

  function search(value: string) {
    const id = ++latest.current;
    startSearch(async () => {
      const result = await searchCatalogTracks(value).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (id !== latest.current) return;
      if (result.ok) {
        setTracks(result.tracks);
        setError(null);
      } else {
        setError(result.error);
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

  return (
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

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={sectionId} className="text-sm font-normal text-stone">
          {canManage ? t("search.section") : t("search.sectionWitness")}
        </Label>
        <Select value={section} onValueChange={(value) => setSection(value as PlaylistSection)}>
          <SelectTrigger id={sectionId} className="h-10 min-w-56 rounded-full bg-card px-4">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAYLIST_SECTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`sections.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
        ) : error ? (
          <p className="rounded-3xl bg-terracotta-soft/60 px-6 py-5 text-center text-charcoal">
            {t(`errors.${error}`)}
          </p>
        ) : tracks === null ? (
          <p className="text-pretty text-stone">{canManage ? t("search.hint") : t("search.hintWitness")}</p>
        ) : tracks.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-8 text-center text-stone">
            {t("search.noResults", { query: query.trim() })}
          </p>
        ) : (
          <ul className={cn("flex flex-col gap-2 transition-opacity duration-300", searching && "opacity-60")}>
            {tracks.map((track) => (
              <ResultRow
                key={track.spotify_id}
                track={track}
                section={section}
                canManage={canManage}
                added={inPlaylist.has(track.spotify_id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  track,
  section,
  canManage,
  added,
}: {
  track: CatalogTrack;
  section: PlaylistSection;
  canManage: boolean;
  added: boolean;
}) {
  const t = useTranslations("Playlist");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addTrack({ ...track, section }).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(canManage ? t("add.success", { name: track.name }) : t("add.suggested", { name: track.name }));
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
            : canManage
              ? t("add.trigger", { name: track.name, artist: track.artist })
              : t("add.suggest", { name: track.name, artist: track.artist })
        }
        className={cn(
          "size-10 shrink-0 rounded-full transition-colors",
          added ? "bg-sage-soft text-sage-deep disabled:opacity-100" : "bg-sage text-ivory hover:bg-sage-deep",
          pending && "animate-pulse",
        )}
      >
        {added ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
      </Button>
    </li>
  );
}

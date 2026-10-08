"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { searchCatalog, SpotifyError } from "@/lib/spotify/server";
import { searchQuerySchema } from "@/lib/spotify/schema";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding, type WeddingRole } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import {
  newTrackSchema,
  sectionSchema,
  type CatalogSearchResult,
  type NewTrack,
  type PlaylistError,
  type PlaylistResult,
} from "./schema";

const trackIdSchema = z.uuid();

const revalidatePlaylist = () => revalidatePath("/[locale]/(app)/playlist", "page");

type Member =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      weddingId: string;
      role: WeddingRole;
    }
  | { ok: false; error: PlaylistError };

/**
 * Mariage courant, pour tout membre : les mariés composent, les témoins
 * proposent. Vérification d'UX : la RLS reste la garantie réelle.
 */
async function getMember(): Promise<Member> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (!role) return { ok: false, error: "forbidden" };
  return { ok: true, supabase, weddingId: wedding.id, role };
}

const isCouple = (role: WeddingRole) => role === "owner" || role === "partner";

const fail = (scope: string, code: string | undefined): PlaylistResult => {
  console.error(`[playlist] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/**
 * Recherche dans le catalogue Spotify, sans compte Spotify : le jeton est
 * celui de l'application. Ouverte à tout membre du mariage.
 */
export async function searchCatalogTracks(query: string): Promise<CatalogSearchResult> {
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const member = await getMember();
  if (!member.ok) return member;

  // Pays du mariage : seuls les morceaux disponibles là-bas sont proposés.
  const { data } = await member.supabase
    .from("weddings")
    .select("country_code")
    .eq("id", member.weddingId)
    .maybeSingle<{ country_code: string | null }>();

  try {
    const tracks = await searchCatalog(parsed.data, data?.country_code ?? null);
    return {
      ok: true,
      tracks: tracks.map((track) => ({
        spotify_id: track.id,
        name: track.name,
        artist: track.artist,
        cover_url: track.cover_url,
        duration_ms: track.duration_ms,
      })),
    };
  } catch (error) {
    if (error instanceof SpotifyError && error.code === "rateLimited") return { ok: false, error: "rateLimited" };
    console.error("[playlist] search:", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "generic" };
  }
}

/** Ajoute un morceau (mariés) ou le propose (témoin). */
export async function addTrack(input: NewTrack): Promise<PlaylistResult> {
  const parsed = newTrackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const member = await getMember();
  if (!member.ok) return member;

  const { error } = await member.supabase.from("playlist_tracks").insert({
    wedding_id: member.weddingId,
    ...parsed.data,
    status: isCouple(member.role) ? "approved" : "suggested",
  });
  if (error?.code === "23505") return { ok: false, error: "duplicate" };
  if (error) return fail("addTrack", error.code);

  revalidatePlaylist();
  return { ok: true };
}

/** Range un morceau dans un autre moment (mariés). */
export async function moveTrack(trackId: string, section: string): Promise<PlaylistResult> {
  const id = trackIdSchema.safeParse(trackId);
  const target = sectionSchema.safeParse(section);
  if (!id.success || !target.success) return { ok: false, error: "invalid" };
  const member = await getMember();
  if (!member.ok) return member;
  if (!isCouple(member.role)) return { ok: false, error: "forbidden" };

  const { data, error } = await member.supabase
    .from("playlist_tracks")
    .update({ section: target.data })
    .eq("id", id.data)
    .eq("wedding_id", member.weddingId)
    .select("id");
  if (error) return fail("moveTrack", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePlaylist();
  return { ok: true };
}

/** Valide la proposition d'un témoin (mariés). */
export async function approveTrack(trackId: string): Promise<PlaylistResult> {
  const id = trackIdSchema.safeParse(trackId);
  if (!id.success) return { ok: false, error: "invalid" };
  const member = await getMember();
  if (!member.ok) return member;
  if (!isCouple(member.role)) return { ok: false, error: "forbidden" };

  const { data, error } = await member.supabase
    .from("playlist_tracks")
    .update({ status: "approved" })
    .eq("id", id.data)
    .eq("wedding_id", member.weddingId)
    .select("id");
  if (error) return fail("approveTrack", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePlaylist();
  return { ok: true };
}

/** Retire un morceau (mariés), ou sa propre proposition (témoin). */
export async function removeTrack(trackId: string): Promise<PlaylistResult> {
  const id = trackIdSchema.safeParse(trackId);
  if (!id.success) return { ok: false, error: "invalid" };
  const member = await getMember();
  if (!member.ok) return member;

  // La RLS ne laisse supprimer que ce qui est permis : rien supprimé = refusé.
  const { data, error } = await member.supabase
    .from("playlist_tracks")
    .delete()
    .eq("id", id.data)
    .eq("wedding_id", member.weddingId)
    .select("id");
  if (error) return fail("removeTrack", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePlaylist();
  return { ok: true };
}

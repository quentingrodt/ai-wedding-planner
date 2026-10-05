"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  folderOf,
  itemDetailsSchema,
  MOODBOARD_BUCKET,
  MOODBOARD_MIME_EXTENSIONS,
  normalizePinterestBoardUrl,
  prepareUploadSchema,
  registerPhotoSchema,
  type ItemDetailsInput,
  type MoodboardError,
  type MoodboardResult,
  type PrepareUploadResult,
} from "@/lib/moodboard/schema";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

const itemIdSchema = z.uuid();

const revalidateMoodboard = () => revalidatePath("/[locale]/(app)/inspiration/planche", "page");

type Member =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: MoodboardError };

/**
 * Mariage courant, pour tout membre (mariés et témoins contribuent à la planche).
 * Vérification d'UX : la RLS (table et Storage) reste la garantie réelle.
 */
async function getMember(): Promise<Member> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (!role) return { ok: false, error: "forbidden" };
  return { ok: true, supabase, weddingId: wedding.id };
}

const fail = (scope: string, code: string | undefined): MoodboardResult => {
  console.error(`[moodboard] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/** URL d'envoi signée : la photo part directement du navigateur vers Storage. */
export async function prepareMoodboardUpload(input: {
  mimeType: string;
  size: number;
}): Promise<PrepareUploadResult> {
  const parsed = prepareUploadSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: field === "size" ? "tooLarge" : "invalidType" };
  }
  const member = await getMember();
  if (!member.ok) return member;

  const path = `${member.weddingId}/${crypto.randomUUID()}.${MOODBOARD_MIME_EXTENSIONS[parsed.data.mimeType]}`;
  const { data, error } = await member.supabase.storage
    .from(MOODBOARD_BUCKET)
    .createSignedUploadUrl(path);
  if (error) {
    console.error("[moodboard] prepareMoodboardUpload:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true, path: data.path, token: data.token };
}

/** Enregistre une photo déjà déposée dans le bucket. */
export async function registerMoodboardPhoto(input: {
  path: string;
  caption: string;
  category: string | null;
}): Promise<MoodboardResult> {
  const parsed = registerPhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const member = await getMember();
  if (!member.ok) return member;
  if (folderOf(parsed.data.path) !== member.weddingId) return { ok: false, error: "forbidden" };

  const { error: infoError } = await member.supabase.storage
    .from(MOODBOARD_BUCKET)
    .info(parsed.data.path);
  if (infoError) return fail("registerMoodboardPhoto (info)", infoError.message);

  const { error } = await member.supabase.from("moodboard_items").insert({
    wedding_id: member.weddingId,
    kind: "photo",
    file_path: parsed.data.path,
    caption: parsed.data.caption,
    category: parsed.data.category,
  });
  // 23505 : chemin déjà enregistré (double envoi), l'opération est idempotente.
  if (error && error.code !== "23505") return fail("registerMoodboardPhoto", error.code);

  revalidateMoodboard();
  return { ok: true };
}

/** Lie un tableau Pinterest public (affiché par le widget officiel). */
export async function addPinterestBoard(rawUrl: string): Promise<MoodboardResult> {
  const url = normalizePinterestBoardUrl(rawUrl);
  if (!url) return { ok: false, error: "invalidPinterest" };
  const member = await getMember();
  if (!member.ok) return member;

  const { error } = await member.supabase.from("moodboard_items").insert({
    wedding_id: member.weddingId,
    kind: "pinterest",
    pinterest_url: url,
  });
  if (error?.code === "23505") return { ok: false, error: "duplicate" };
  if (error) return fail("addPinterestBoard", error.code);

  revalidateMoodboard();
  return { ok: true };
}

/** Légende et catégorie d'un élément (mariés ou auteur, selon la RLS). */
export async function updateMoodboardItem(
  itemId: string,
  input: ItemDetailsInput,
): Promise<MoodboardResult> {
  const parsed = itemDetailsSchema.safeParse(input);
  if (!parsed.success || !itemIdSchema.safeParse(itemId).success) {
    return { ok: false, error: "generic" };
  }
  const member = await getMember();
  if (!member.ok) return member;

  const { data, error } = await member.supabase
    .from("moodboard_items")
    .update(parsed.data)
    .eq("id", itemId)
    .eq("wedding_id", member.weddingId)
    .select("id");
  if (error) return fail("updateMoodboardItem", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateMoodboard();
  return { ok: true };
}

/** Retire un élément ; la photo est aussi effacée du bucket. */
export async function deleteMoodboardItem(itemId: string): Promise<MoodboardResult> {
  if (!itemIdSchema.safeParse(itemId).success) return { ok: false, error: "generic" };
  const member = await getMember();
  if (!member.ok) return member;

  const { data, error } = await member.supabase
    .from("moodboard_items")
    .delete()
    .eq("id", itemId)
    .eq("wedding_id", member.weddingId)
    .select("file_path");
  if (error) return fail("deleteMoodboardItem", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  const path = data[0].file_path as string | null;
  if (path) {
    const { error: storageError } = await member.supabase.storage
      .from(MOODBOARD_BUCKET)
      .remove([path]);
    // La ligne est supprimée : un fichier orphelin n'est plus affiché nulle part.
    if (storageError) console.error("[moodboard] delete (storage):", storageError.message);
  }

  revalidateMoodboard();
  return { ok: true };
}

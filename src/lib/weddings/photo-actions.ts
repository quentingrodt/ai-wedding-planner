"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import {
  photoFolderOf,
  WEDDING_PHOTO_BUCKET,
  WEDDING_PHOTO_MAX_BYTES,
  weddingPhotoPathSchema,
  type PrepareWeddingPhotoResult,
  type WeddingPhotoError,
  type WeddingPhotoResult,
} from "./photo";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding } from "./queries";

type Couple =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      weddingId: string;
      photoPath: string | null;
    }
  | { ok: false; error: WeddingPhotoError };

/**
 * Mariage courant, pour les mariés seulement. Vérification d'UX : la RLS
 * (colonne et bucket) reste la garantie réelle.
 */
async function getCouple(): Promise<Couple> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };
  return { ok: true, supabase, weddingId: wedding.id, photoPath: wedding.photo_path };
}

const fail = (scope: string, code: string | undefined): WeddingPhotoResult => {
  console.error(`[wedding-photo] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

// Le menu (layout) et le tableau de bord affichent la photo.
const revalidatePhoto = () => revalidatePath("/", "layout");

/** Ancienne photo retirée du bucket ; un échec ne bloque pas l'opération. */
async function removeFile(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (path === null) return;
  const { error } = await supabase.storage.from(WEDDING_PHOTO_BUCKET).remove([path]);
  if (error) console.error("[wedding-photo] remove (storage):", error.message);
}

const prepareSchema = z.object({
  mimeType: z.literal("image/jpeg"),
  size: z.number().int().positive().max(WEDDING_PHOTO_MAX_BYTES),
});

/** URL d'envoi signée : la photo recadrée part directement du navigateur vers Storage. */
export async function prepareWeddingPhotoUpload(input: {
  mimeType: string;
  size: number;
}): Promise<PrepareWeddingPhotoResult> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: field === "size" ? "tooLarge" : "invalidType" };
  }
  const couple = await getCouple();
  if (!couple.ok) return couple;

  const path = `${couple.weddingId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await couple.supabase.storage
    .from(WEDDING_PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error) {
    console.error("[wedding-photo] prepareWeddingPhotoUpload:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true, path: data.path, token: data.token };
}

/** Fait d'une photo déjà déposée la photo du couple, et efface la précédente. */
export async function setWeddingPhoto(path: string): Promise<WeddingPhotoResult> {
  const parsed = weddingPhotoPathSchema.safeParse(path);
  if (!parsed.success) return { ok: false, error: "generic" };
  const couple = await getCouple();
  if (!couple.ok) return couple;
  if (photoFolderOf(parsed.data) !== couple.weddingId) return { ok: false, error: "forbidden" };

  const { error: infoError } = await couple.supabase.storage.from(WEDDING_PHOTO_BUCKET).info(parsed.data);
  if (infoError) return fail("setWeddingPhoto (info)", infoError.message);

  const { error } = await couple.supabase
    .from("weddings")
    .update({ photo_path: parsed.data })
    .eq("id", couple.weddingId);
  if (error) return fail("setWeddingPhoto", error.code);

  if (couple.photoPath !== parsed.data) await removeFile(couple.supabase, couple.photoPath);
  revalidatePhoto();
  return { ok: true };
}

/** Retire la photo : le monogramme reprend sa place. */
export async function removeWeddingPhoto(): Promise<WeddingPhotoResult> {
  const couple = await getCouple();
  if (!couple.ok) return couple;
  if (couple.photoPath === null) return { ok: true };

  const { error } = await couple.supabase
    .from("weddings")
    .update({ photo_path: null })
    .eq("id", couple.weddingId);
  if (error) return fail("removeWeddingPhoto", error.code);

  await removeFile(couple.supabase, couple.photoPath);
  revalidatePhoto();
  return { ok: true };
}

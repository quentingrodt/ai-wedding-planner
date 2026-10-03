"use server";

import { revalidatePath } from "next/cache";
import {
  QUOTE_MIME_EXTENSIONS,
  QUOTES_BUCKET,
  prepareQuoteUploadSchema,
  quoteFolderOf,
  registerQuoteSchema,
  type PrepareQuoteUploadInput,
  type PrepareQuoteUploadResult,
  type QuoteUploadError,
  type RegisterQuoteInput,
  type RegisterQuoteResult,
} from "@/lib/quotes/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

type Writer =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      weddingId: string;
    }
  | { ok: false; error: QuoteUploadError };

/**
 * Mariage courant, si l'utilisateur peut y déposer des devis (owner ou partner).
 * Vérification d'UX : la RLS (table et Storage) reste la garantie réelle.
 */
async function getQuoteWriter(): Promise<Writer> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, supabase, weddingId: wedding.id };
}

/**
 * Génère une URL d'upload signée : le fichier part ensuite directement du
 * navigateur vers Supabase, sans transiter par le serveur Next.
 * Le chemin est choisi ici, jamais par le client.
 */
export async function prepareQuoteUpload(
  input: PrepareQuoteUploadInput,
): Promise<PrepareQuoteUploadResult> {
  const parsed = prepareQuoteUploadSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "mimeType") return { ok: false, error: "invalidType" };
    if (field === "size") return { ok: false, error: "tooLarge" };
    return { ok: false, error: "generic" };
  }

  const writer = await getQuoteWriter();
  if (!writer.ok) return writer;

  const extension = QUOTE_MIME_EXTENSIONS[parsed.data.mimeType];
  const path = `${writer.weddingId}/${crypto.randomUUID()}.${extension}`;

  // Client de session : la policy INSERT du bucket est vérifiée à la signature.
  const { data, error } = await writer.supabase.storage
    .from(QUOTES_BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    console.error("[quotes] prepareQuoteUpload:", error.message);
    return { ok: false, error: "generic" };
  }
  return { ok: true, path: data.path, token: data.token };
}

/** Enregistre en base un devis déjà téléversé dans le bucket. */
export async function registerQuote(
  input: RegisterQuoteInput,
): Promise<RegisterQuoteResult> {
  const parsed = registerQuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { path, fileName } = parsed.data;

  const writer = await getQuoteWriter();
  if (!writer.ok) return writer;
  if (quoteFolderOf(path) !== writer.weddingId) {
    return { ok: false, error: "forbidden" };
  }

  // Le fichier doit réellement exister (et être lisible) dans le bucket.
  const { error: infoError } = await writer.supabase.storage
    .from(QUOTES_BUCKET)
    .info(path);
  if (infoError) {
    console.error("[quotes] registerQuote (info):", infoError.message);
    return { ok: false, error: "generic" };
  }

  const { error } = await writer.supabase.from("quotes").insert({
    wedding_id: writer.weddingId,
    file_path: path,
    file_name: fileName,
  });

  // 23505 : chemin déjà enregistré (double envoi), l'opération est idempotente.
  if (error && error.code !== "23505") {
    console.error("[quotes] registerQuote:", error.code);
    return {
      ok: false,
      error: error.code === "42501" ? "forbidden" : "generic",
    };
  }

  revalidatePath("/[locale]/quotes", "page");
  return { ok: true };
}

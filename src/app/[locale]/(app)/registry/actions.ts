"use server";

import { revalidatePath } from "next/cache";
import { fetchProductPreview, type LinkPreviewResult } from "@/lib/registry/link-preview";
import {
  fundInputSchema,
  giftInputSchema,
  idSchema,
  registrySettingsSchema,
  setUpRegistrySchema,
  type FundInput,
  type GiftInput,
  type RegistryActionError,
  type RegistryActionResult,
  type RegistrySettingsInput,
  type SetUpRegistryInput,
} from "@/lib/registry/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /registry (fr, sans préfixe) et /en/registry.
const revalidateRegistry = () => revalidatePath("/[locale]/(app)/registry", "page");

type CoupleContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: RegistryActionError };

/** Mariage courant, si l'utilisateur en est owner ou partner (vérification d'UX : la RLS reste la garantie). */
async function coupleContext(): Promise<CoupleContext> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };
  return { ok: true, supabase, weddingId: wedding.id };
}

const failure = (scope: string, code: string | undefined): RegistryActionResult => {
  console.error(`[registry] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/**
 * Fin du parcours d'ouverture : crée la liste, ses cadeaux et les projets
 * de l'urne. Refusé si la liste existe déjà (contrainte unique).
 */
export async function setUpRegistry(input: SetUpRegistryInput): Promise<RegistryActionResult> {
  const parsed = setUpRegistrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const { gifts, funds, note, acceptsSuggestions, paymentLink, paymentDetails } = parsed.data;

  const { error: registryError } = await supabase.from("registries").insert({
    wedding_id: weddingId,
    note,
    accepts_suggestions: acceptsSuggestions,
    payment_link: paymentLink,
    payment_details: paymentDetails,
  });
  if (registryError) return failure("setUpRegistry", registryError.code);

  if (gifts.length > 0) {
    const { error } = await supabase.from("registry_gifts").insert(
      gifts.map((gift, position) => ({
        wedding_id: weddingId,
        section: gift.section,
        title: gift.title,
        is_heirloom: gift.isHeirloom,
        position,
      })),
    );
    if (error) return failure("setUpRegistry gifts", error.code);
  }
  if (funds.length > 0) {
    const { error } = await supabase.from("registry_funds").insert(
      funds.map((fund, position) => ({ wedding_id: weddingId, ...fund, position })),
    );
    if (error) return failure("setUpRegistry funds", error.code);
  }

  revalidateRegistry();
  return { ok: true };
}

/** Crée un cadeau (giftId null) ou le modifie. */
export async function saveGift(giftId: string | null, input: GiftInput): Promise<RegistryActionResult> {
  const parsed = giftInputSchema.safeParse(input);
  if (!parsed.success || (giftId !== null && !idSchema.safeParse(giftId).success)) {
    return { ok: false, error: "invalid" };
  }
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const { imageUrl, isHeirloom, ...gift } = parsed.data;
  const row = { ...gift, image_url: imageUrl, is_heirloom: isHeirloom };

  if (giftId === null) {
    // En fin de rubrique : la position suit le nombre de cadeaux déjà créés.
    const { count } = await supabase
      .from("registry_gifts")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId);
    const { error } = await supabase
      .from("registry_gifts")
      .insert({ ...row, wedding_id: weddingId, position: count ?? 0 });
    if (error) return failure("saveGift insert", error.code);
  } else {
    const { data, error } = await supabase
      .from("registry_gifts")
      .update(row)
      .eq("id", giftId)
      .select("id");
    if (error) return failure("saveGift update", error.code);
    if (data.length === 0) return { ok: false, error: "forbidden" };
  }

  revalidateRegistry();
  return { ok: true };
}

/** Retire un cadeau de la liste. */
export async function deleteGift(giftId: string): Promise<RegistryActionResult> {
  return deleteRow("registry_gifts", giftId);
}

/** Crée un projet de l'urne (fundId null) ou le modifie. */
export async function saveFund(fundId: string | null, input: FundInput): Promise<RegistryActionResult> {
  const parsed = fundInputSchema.safeParse(input);
  if (!parsed.success || (fundId !== null && !idSchema.safeParse(fundId).success)) {
    return { ok: false, error: "invalid" };
  }
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;

  if (fundId === null) {
    const { count } = await supabase
      .from("registry_funds")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId);
    const { error } = await supabase
      .from("registry_funds")
      .insert({ ...parsed.data, wedding_id: weddingId, position: count ?? 0 });
    if (error) return failure("saveFund insert", error.code);
  } else {
    const { data, error } = await supabase
      .from("registry_funds")
      .update(parsed.data)
      .eq("id", fundId)
      .select("id");
    if (error) return failure("saveFund update", error.code);
    if (data.length === 0) return { ok: false, error: "forbidden" };
  }

  revalidateRegistry();
  return { ok: true };
}

/** Retire une idée de la boîte à idées. */
export async function deleteSuggestion(suggestionId: string): Promise<RegistryActionResult> {
  return deleteRow("registry_suggestions", suggestionId);
}

/** Retire un projet de l'urne. */
export async function deleteFund(fundId: string): Promise<RegistryActionResult> {
  return deleteRow("registry_funds", fundId);
}

async function deleteRow(
  table: "registry_gifts" | "registry_funds" | "registry_suggestions",
  id: string,
): Promise<RegistryActionResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase.from(table).delete().eq("id", id).select("id");
  if (error) return failure(`delete ${table}`, error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateRegistry();
  return { ok: true };
}

/** Mot aux invités, boîte à idées et moyen de participer à l'urne. */
export async function updateRegistrySettings(
  input: RegistrySettingsInput,
): Promise<RegistryActionResult> {
  const parsed = registrySettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { note, acceptsSuggestions, paymentLink, paymentDetails } = parsed.data;

  const { data, error } = await context.supabase
    .from("registries")
    .update({
      note,
      accepts_suggestions: acceptsSuggestions,
      payment_link: paymentLink,
      payment_details: paymentDetails,
      updated_at: new Date().toISOString(),
    })
    .eq("wedding_id", context.weddingId)
    .select("wedding_id");
  if (error) return failure("updateRegistrySettings", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateRegistry();
  return { ok: true };
}

/**
 * Titre, prix et image d'une page produit collée par les mariés. Réservé aux
 * mariés connectés : l'app ne doit pas servir de relais ouvert vers le web.
 */
export async function previewProductLink(url: string): Promise<LinkPreviewResult> {
  if (typeof url !== "string" || url.length > 1000) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return { ok: false, error: "invalid" };
  return fetchProductPreview(url);
}

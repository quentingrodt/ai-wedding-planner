"use server";

import { revalidatePath } from "next/cache";
import {
  assignGuestsSchema,
  idSchema,
  lodgingInputSchema,
  lodgingStatusSchema,
  setNeedsLodgingSchema,
  toLodgingRow,
  type LodgingActionError,
  type LodgingActionResult,
  type LodgingInput,
} from "@/lib/lodging/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /accommodation (fr, sans préfixe) et /en/accommodation.
const revalidateLodging = () => revalidatePath("/[locale]/(app)/accommodation", "page");

type CoupleContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: LodgingActionError };

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

const failure = (scope: string, code: string | undefined): LodgingActionResult => {
  console.error(`[lodging] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/** Marque un invité, ou tout un foyer, comme venant de loin (ou non). */
export async function setNeedsLodging(input: { guestIds: string[]; needsLodging: boolean }): Promise<LodgingActionResult> {
  const parsed = setNeedsLodgingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase
    .from("guests")
    // Qui ne vient plus de loin n'a plus d'hébergement attribué.
    .update(parsed.data.needsLodging ? { needs_lodging: true } : { needs_lodging: false, lodging_id: null })
    .eq("wedding_id", context.weddingId)
    .in("id", parsed.data.guestIds)
    .select("id");
  if (error) return failure("setNeedsLodging", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateLodging();
  return { ok: true };
}

/**
 * Invités logés dans un hébergement : ceux de la liste y sont attribués (et
 * quittent leur hébergement précédent), les autres qui y étaient le quittent.
 */
export async function assignGuests(input: { lodgingId: string; guestIds: string[] }): Promise<LodgingActionResult> {
  const parsed = assignGuestsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const { lodgingId, guestIds } = parsed.data;

  let release = supabase
    .from("guests")
    .update({ lodging_id: null })
    .eq("wedding_id", weddingId)
    .eq("lodging_id", lodgingId);
  if (guestIds.length > 0) release = release.not("id", "in", `(${guestIds.join(",")})`);
  const { error: releaseError } = await release;
  if (releaseError) return failure("assignGuests release", releaseError.code);

  if (guestIds.length > 0) {
    // La clé étrangère composite (000030) refuse un hébergement d'un autre mariage.
    const { error } = await supabase
      .from("guests")
      .update({ lodging_id: lodgingId, needs_lodging: true })
      .eq("wedding_id", weddingId)
      .in("id", guestIds);
    if (error) return failure("assignGuests", error.code);
  }

  revalidateLodging();
  return { ok: true };
}

/** Crée un hébergement (lodgingId null) ou modifie sa fiche. */
export async function saveLodging(lodgingId: string | null, input: LodgingInput): Promise<LodgingActionResult> {
  const parsed = lodgingInputSchema.safeParse(input);
  if (!parsed.success || (lodgingId !== null && !idSchema.safeParse(lodgingId).success)) {
    return { ok: false, error: "invalid" };
  }
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const row = toLodgingRow(parsed.data);

  if (lodgingId === null) {
    const { count } = await supabase
      .from("guest_lodgings")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId);
    const { error } = await supabase
      .from("guest_lodgings")
      .insert({ ...row, wedding_id: weddingId, position: count ?? 0 });
    if (error) return failure("saveLodging insert", error.code);
  } else {
    const { data, error } = await supabase
      .from("guest_lodgings")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", lodgingId)
      .select("id");
    if (error) return failure("saveLodging update", error.code);
    if (data.length === 0) return { ok: false, error: "forbidden" };
  }

  revalidateLodging();
  return { ok: true };
}

/** Avancement d'un hébergement, sans ouvrir sa fiche. */
export async function setLodgingStatus(lodgingId: string, status: string): Promise<LodgingActionResult> {
  const parsedStatus = lodgingStatusSchema.safeParse(status);
  if (!idSchema.safeParse(lodgingId).success || !parsedStatus.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase
    .from("guest_lodgings")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", lodgingId)
    .select("id");
  if (error) return failure("setLodgingStatus", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateLodging();
  return { ok: true };
}

/** Retire un hébergement de la liste. */
export async function deleteLodging(lodgingId: string): Promise<LodgingActionResult> {
  if (!idSchema.safeParse(lodgingId).success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase.from("guest_lodgings").delete().eq("id", lodgingId).select("id");
  if (error) return failure("deleteLodging", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateLodging();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import {
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
    .update({ needs_lodging: parsed.data.needsLodging })
    .eq("wedding_id", context.weddingId)
    .in("id", parsed.data.guestIds)
    .select("id");
  if (error) return failure("setNeedsLodging", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
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

"use server";

import { revalidatePath } from "next/cache";
import { VENDOR_CATALOG, type VendorCategory } from "@/lib/vendors/catalog";
import { detailsSchema } from "@/lib/vendors/details";
import { PLAN_SCHEMAS, type PlanCategory } from "@/lib/vendors/plans";
import {
  idSchema,
  toVendorRow,
  vendorCategorySchema,
  vendorInputSchema,
  vendorStatusSchema,
  type VendorActionError,
  type VendorActionResult,
  type VendorInput,
} from "@/lib/vendors/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Patterns de route : la vue d'ensemble et chaque catégorie, en fr (sans préfixe) et en.
function revalidateVendors() {
  revalidatePath("/[locale]/(app)/vendors", "page");
  revalidatePath("/[locale]/(app)/vendors/[category]", "page");
}

type CoupleContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: VendorActionError };

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

const failure = (scope: string, code: string | undefined): VendorActionResult => {
  console.error(`[vendors] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/** Un prestataire réservé coche les étapes de sa catégorie dans le rétroplanning. */
async function completeTasks(
  context: Extract<CoupleContext, { ok: true }>,
  category: VendorCategory,
) {
  const keys = VENDOR_CATALOG[category].tasks;
  if (keys.length === 0) return;
  const { error } = await context.supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("wedding_id", context.weddingId)
    .in("template_key", keys);
  // Le prestataire est réservé : un rétroplanning non coché ne remet pas le choix en cause.
  if (error) console.error("[vendors] completeTasks:", error.code);
  revalidatePath("/[locale]/(app)/planning", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
}

/** Crée une piste dans une catégorie (vendorId null) ou modifie sa fiche. */
export async function saveVendor(
  category: string,
  vendorId: string | null,
  input: VendorInput,
): Promise<VendorActionResult> {
  const parsedCategory = vendorCategorySchema.safeParse(category);
  const parsed = vendorInputSchema.safeParse(input);
  if (!parsedCategory.success || !parsed.success || (vendorId !== null && !idSchema.safeParse(vendorId).success)) {
    return { ok: false, error: "invalid" };
  }
  const details = detailsSchema(parsedCategory.data).safeParse(parsed.data.details);
  if (!details.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const row = { ...toVendorRow(parsed.data), details: details.data };

  if (vendorId === null) {
    const { count } = await supabase
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId)
      .eq("category", parsedCategory.data);
    const { error } = await supabase
      .from("vendors")
      .insert({ ...row, wedding_id: weddingId, category: parsedCategory.data, position: count ?? 0 });
    if (error) return failure("saveVendor insert", error.code);
  } else {
    const { data, error } = await supabase
      .from("vendors")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", vendorId)
      .select("id");
    if (error) return failure("saveVendor update", error.code);
    if (data.length === 0) return { ok: false, error: "forbidden" };
  }

  if (row.status === "booked") await completeTasks(context, parsedCategory.data);
  revalidateVendors();
  return { ok: true };
}

/** Avancement d'une piste, sans ouvrir sa fiche ; « réservé » coche le rétroplanning. */
export async function setVendorStatus(vendorId: string, status: string): Promise<VendorActionResult> {
  const parsedStatus = vendorStatusSchema.safeParse(status);
  if (!idSchema.safeParse(vendorId).success || !parsedStatus.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase
    .from("vendors")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", vendorId)
    .select("category")
    .returns<{ category: VendorCategory }[]>();
  if (error) return failure("setVendorStatus", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  if (parsedStatus.data === "booked") await completeTasks(context, data[0].category);
  revalidateVendors();
  return { ok: true };
}

/** Retire une piste. */
export async function deleteVendor(vendorId: string): Promise<VendorActionResult> {
  if (!idSchema.safeParse(vendorId).success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase.from("vendors").delete().eq("id", vendorId).select("id");
  if (error) return failure("deleteVendor", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateVendors();
  return { ok: true };
}

/** Enregistre le carnet d'une catégorie (menu, préparatifs, mensurations…). */
export async function saveVendorPlan(category: string, data: unknown): Promise<VendorActionResult> {
  if (!Object.hasOwn(PLAN_SCHEMAS, category)) return { ok: false, error: "invalid" };
  const schema = PLAN_SCHEMAS[category as PlanCategory];
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  // Mise à jour d'abord : wedding_id et category n'ont pas le droit UPDATE (un upsert les réécrirait).
  const { data: updated, error: updateError } = await context.supabase
    .from("vendor_plans")
    .update({ data: parsed.data, updated_at: new Date().toISOString() })
    .eq("wedding_id", context.weddingId)
    .eq("category", category)
    .select("category");
  if (updateError) return failure("saveVendorPlan update", updateError.code);
  if (updated.length === 0) {
    const { error } = await context.supabase
      .from("vendor_plans")
      .insert({ wedding_id: context.weddingId, category, data: parsed.data });
    if (error) return failure("saveVendorPlan insert", error.code);
  }
  revalidateVendors();
  return { ok: true };
}

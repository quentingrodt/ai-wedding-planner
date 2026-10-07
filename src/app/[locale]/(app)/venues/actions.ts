"use server";

import { revalidatePath } from "next/cache";
import {
  editableStatusSchema,
  idSchema,
  toVenueRow,
  venueInputSchema,
  type VenueActionError,
  type VenueActionResult,
  type VenueInput,
} from "@/lib/venues/schema";
import type { VenueStatus } from "@/lib/venues/catalog";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /venues (fr, sans préfixe) et /en/venues.
const revalidateVenues = () => revalidatePath("/[locale]/(app)/venues", "page");

/** Étapes du rétroplanning accomplies quand le lieu est retenu (cf. planning/catalog.ts). */
const VENUE_TASK_KEYS = ["explore_venues", "book_venue"];

type CoupleContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: VenueActionError };

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

const failure = (scope: string, code: string | undefined): VenueActionResult => {
  console.error(`[venues] ${scope}:`, code);
  return { ok: false, error: code === "42501" ? "forbidden" : "generic" };
};

/** Crée un lieu (venueId null) ou modifie sa fiche. */
export async function saveVenue(venueId: string | null, input: VenueInput): Promise<VenueActionResult> {
  const parsed = venueInputSchema.safeParse(input);
  if (!parsed.success || (venueId !== null && !idSchema.safeParse(venueId).success)) {
    return { ok: false, error: "invalid" };
  }
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;
  const row = toVenueRow(parsed.data);

  if (venueId === null) {
    const { count } = await supabase
      .from("venues")
      .select("id", { count: "exact", head: true })
      .eq("wedding_id", weddingId);
    const { error } = await supabase
      .from("venues")
      .insert({ ...row, wedding_id: weddingId, position: count ?? 0 });
    if (error) return failure("saveVenue insert", error.code);
  } else {
    const { data, error } = await supabase
      .from("venues")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", venueId)
      .select("id");
    if (error) return failure("saveVenue update", error.code);
    if (data.length === 0) return { ok: false, error: "forbidden" };
  }

  revalidateVenues();
  return { ok: true };
}

/** Avancement d'un lieu (short-list, écarté…), sans ouvrir sa fiche. */
export async function setVenueStatus(venueId: string, status: string): Promise<VenueActionResult> {
  const parsedStatus = editableStatusSchema.safeParse(status);
  if (!idSchema.safeParse(venueId).success || !parsedStatus.success) return { ok: false, error: "invalid" };
  return updateStatus(venueId, parsedStatus.data);
}

/**
 * Choix final : ce lieu est retenu, celui qui l'était revient dans la
 * short-list, et les étapes « lieu » du rétroplanning sont cochées.
 */
export async function chooseVenue(venueId: string): Promise<VenueActionResult> {
  if (!idSchema.safeParse(venueId).success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { supabase, weddingId } = context;

  // D'abord libérer l'ancien choix : l'index unique n'admet qu'un lieu retenu.
  const { error: releaseError } = await supabase
    .from("venues")
    .update({ status: "shortlisted", updated_at: new Date().toISOString() })
    .eq("wedding_id", weddingId)
    .eq("status", "booked")
    .neq("id", venueId);
  if (releaseError) return failure("chooseVenue release", releaseError.code);

  const result = await updateStatus(venueId, "booked", context);
  if (!result.ok) return result;

  const { error: tasksError } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("wedding_id", weddingId)
    .in("template_key", VENUE_TASK_KEYS);
  // Le lieu est retenu : un rétroplanning non coché ne remet pas le choix en cause.
  if (tasksError) console.error("[venues] chooseVenue tasks:", tasksError.code);
  revalidatePath("/[locale]/(app)/planning", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
  return { ok: true };
}

async function updateStatus(
  venueId: string,
  status: VenueStatus,
  known?: Extract<CoupleContext, { ok: true }>,
): Promise<VenueActionResult> {
  const context = known ?? (await coupleContext());
  if (!context.ok) return context;
  const { data, error } = await context.supabase
    .from("venues")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", venueId)
    .select("id");
  if (error) return failure(`status ${status}`, error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateVenues();
  return { ok: true };
}

/** Retire un lieu de la liste. */
export async function deleteVenue(venueId: string): Promise<VenueActionResult> {
  if (!idSchema.safeParse(venueId).success) return { ok: false, error: "invalid" };
  const context = await coupleContext();
  if (!context.ok) return context;
  const { data, error } = await context.supabase.from("venues").delete().eq("id", venueId).select("id");
  if (error) return failure("deleteVenue", error.code);
  if (data.length === 0) return { ok: false, error: "forbidden" };
  revalidateVenues();
  return { ok: true };
}

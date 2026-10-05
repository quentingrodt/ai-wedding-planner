"use server";

import { revalidatePath } from "next/cache";
import {
  addGuestSchema,
  assignFamilySchema,
  deleteFamilySchema,
  deleteGuestSchema,
  familyNameSchema,
  renameFamilySchema,
  updateGuestStatusSchema,
  type AddGuestInput,
  type AddGuestResult,
  type CreateFamilyResult,
  type FamilyNameError,
  type GuestActionResult,
  type RenameFamilyResult,
  type GuestField,
  type GuestFieldError,
  type GuestStatus,
} from "@/lib/guests/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /guests (fr, sans préfixe) et /en/guests.
// Le plan de table dépend des réponses : on le revalide aussi.
const revalidateGuests = () => {
  revalidatePath("/[locale]/(app)/guests", "page");
  revalidatePath("/[locale]/(app)/seating", "page");
};

/** Ajoute un invité au mariage courant (owner ou partner). */
export async function addGuest(input: AddGuestInput): Promise<AddGuestResult> {
  const parsed = addGuestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<GuestField, GuestFieldError>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as GuestField;
      fieldErrors[field] ??= issue.code === "too_big" ? "tooLong" : "required";
    }
    return { ok: false, error: "invalid", fieldErrors };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  // Vérification d'UX : la RLS reste la garantie réelle.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }

  const { firstName, lastName, status, dietaryRequirements, isChild, familyId } = parsed.data;
  // La clé étrangère composite refuse une famille d'un autre mariage.
  const { error } = await supabase.from("guests").insert({
    wedding_id: wedding.id,
    first_name: firstName,
    last_name: lastName,
    status,
    dietary_requirements: dietaryRequirements,
    is_child: isChild,
    family_id: familyId,
  });

  if (error) {
    console.error("[guests] addGuest:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateGuests();
  return { ok: true };
}

/** Met à jour la réponse (RSVP) d'un invité. */
export async function updateGuestStatus(
  guestId: string,
  status: GuestStatus,
): Promise<GuestActionResult> {
  const parsed = updateGuestStatusSchema.safeParse({ guestId, status });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  // Sans ligne renvoyée, l'invité n'existe pas ou la RLS refuse l'écriture
  // (un témoin peut lire la ligne mais pas la modifier).
  // Seuls les confirmés occupent une place : tout autre statut libère la table.
  const { data, error } = await supabase
    .from("guests")
    .update(
      parsed.data.status === "confirmed"
        ? { status: parsed.data.status }
        : { status: parsed.data.status, seating_table_id: null },
    )
    .eq("id", parsed.data.guestId)
    .select("id");

  if (error) {
    console.error("[guests] updateGuestStatus:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateGuests();
  return { ok: true };
}

/** Retire un invité de la liste. */
export async function deleteGuest(guestId: string): Promise<GuestActionResult> {
  const parsed = deleteGuestSchema.safeParse({ guestId });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("guests")
    .delete()
    .eq("id", parsed.data.guestId)
    .select("id");

  if (error) {
    console.error("[guests] deleteGuest:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateGuests();
  return { ok: true };
}

function familyNameError(issueCode: string | undefined): FamilyNameError {
  return issueCode === "too_big" ? "tooLong" : "required";
}

/** Crée une famille d'invités dans le mariage courant (owner ou partner). */
export async function createFamily(name: string): Promise<CreateFamilyResult> {
  const parsed = familyNameSchema.safeParse({ name });
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid",
      fieldError: familyNameError(parsed.error.issues[0]?.code),
    };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  // Vérification d'UX : la RLS reste la garantie réelle.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }

  const { data, error } = await supabase
    .from("guest_families")
    .insert({ wedding_id: wedding.id, name: parsed.data.name })
    .select("id")
    .single();

  if (error) {
    console.error("[guests] createFamily:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateGuests();
  return { ok: true, familyId: data.id };
}

/** Renomme une famille. */
export async function renameFamily(
  familyId: string,
  name: string,
): Promise<RenameFamilyResult> {
  const parsed = renameFamilySchema.safeParse({ familyId, name });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "familyId") return { ok: false, error: "generic" };
    return { ok: false, error: "invalid", fieldError: familyNameError(issue?.code) };
  }

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("guest_families")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.familyId)
    .select("id");

  if (error) {
    console.error("[guests] renameFamily:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateGuests();
  return { ok: true };
}

/** Supprime une famille : ses membres restent sur la liste, sans famille. */
export async function deleteFamily(familyId: string): Promise<GuestActionResult> {
  const parsed = deleteFamilySchema.safeParse({ familyId });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("guest_families")
    .delete()
    .eq("id", parsed.data.familyId)
    .select("id");

  if (error) {
    console.error("[guests] deleteFamily:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateGuests();
  return { ok: true };
}

/** Rattache un invité à une famille, ou l'en détache (familyId null). */
export async function assignGuestFamily(
  guestId: string,
  familyId: string | null,
): Promise<GuestActionResult> {
  const parsed = assignFamilySchema.safeParse({ guestId, familyId });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  // La clé étrangère composite refuse une famille d'un autre mariage.
  const { data, error } = await supabase
    .from("guests")
    .update({ family_id: parsed.data.familyId })
    .eq("id", parsed.data.guestId)
    .select("id");

  if (error) {
    console.error("[guests] assignGuestFamily:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateGuests();
  return { ok: true };
}

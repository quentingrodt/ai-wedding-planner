"use server";

import { revalidatePath } from "next/cache";
import {
  addGuestSchema,
  deleteGuestSchema,
  updateGuestStatusSchema,
  type AddGuestInput,
  type AddGuestResult,
  type GuestActionResult,
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
  revalidatePath("/[locale]/guests", "page");
  revalidatePath("/[locale]/seating", "page");
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

  const { firstName, lastName, status, dietaryRequirements, isChild } = parsed.data;
  const { error } = await supabase.from("guests").insert({
    wedding_id: wedding.id,
    first_name: firstName,
    last_name: lastName,
    status,
    dietary_requirements: dietaryRequirements,
    is_child: isChild,
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

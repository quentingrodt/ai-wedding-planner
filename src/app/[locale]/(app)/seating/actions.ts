"use server";

import { revalidatePath } from "next/cache";
import {
  assignGuestSchema,
  createTableSchema,
  deleteTableSchema,
  type CreateTableResult,
  type SeatingActionResult,
  type TableField,
  type TableFieldError,
} from "@/lib/seating/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /seating (fr, sans préfixe) et /en/seating.
const revalidateSeating = () => revalidatePath("/[locale]/(app)/seating", "page");

/** Crée une table dans le mariage courant (owner ou partner). */
export async function createTable(name: string, capacity: number): Promise<CreateTableResult> {
  const parsed = createTableSchema.safeParse({ name, capacity });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<TableField, TableFieldError>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as TableField;
      fieldErrors[field] ??=
        field === "capacity" ? "capacity" : issue.code === "too_big" ? "tooLong" : "required";
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

  const { error } = await supabase.from("seating_tables").insert({
    wedding_id: wedding.id,
    name: parsed.data.name,
    capacity: parsed.data.capacity,
  });

  if (error) {
    console.error("[seating] createTable:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateSeating();
  return { ok: true };
}

/** Supprime une table : ses invités repassent « à placer » (ON DELETE SET NULL). */
export async function deleteTable(tableId: string): Promise<SeatingActionResult> {
  const parsed = deleteTableSchema.safeParse({ tableId });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("seating_tables")
    .delete()
    .eq("id", parsed.data.tableId)
    .select("id");

  if (error) {
    console.error("[seating] deleteTable:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateSeating();
  return { ok: true };
}

/** Place un invité confirmé à une table, ou le renvoie « à placer » avec null. */
export async function assignGuestToTable(
  guestId: string,
  tableId: string | null,
): Promise<SeatingActionResult> {
  const parsed = assignGuestSchema.safeParse({ guestId, tableId });
  if (!parsed.success) return { ok: false, error: "generic" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  // La clé composite garantit que la table appartient au même mariage ;
  // le trigger enforce_seating_capacity refuse une table pleine.
  const { data, error } = await supabase
    .from("guests")
    .update({ seating_table_id: parsed.data.tableId })
    .eq("id", parsed.data.guestId)
    .eq("status", "confirmed")
    .select("id");

  if (error) {
    console.error("[seating] assignGuestToTable:", error.code);
    if (error.code === "P0001" && error.hint === "table_full") {
      return { ok: false, error: "tableFull" };
    }
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateSeating();
  return { ok: true };
}

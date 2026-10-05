"use server";

import { revalidatePath } from "next/cache";
import {
  budgetItemIdSchema,
  parseBudgetItem,
  type BudgetActionResult,
  type BudgetItemInput,
} from "@/lib/budget/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /budget (fr, sans préfixe) et /en/budget.
// La jauge du tableau de bord lit les mêmes lignes : on la revalide aussi.
const revalidateBudget = () => {
  revalidatePath("/[locale]/(app)/budget", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
};

/** Ajoute un prestataire (ligne de budget) au mariage courant (owner ou partner). */
export async function addBudgetItem(input: BudgetItemInput): Promise<BudgetActionResult> {
  const parsed = parseBudgetItem(input);
  if (!parsed.ok) return { ok: false, error: "invalid" };

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

  const { category, label, estimatedAmount, actualAmount, sourcing, suggestedAmount } = parsed.data;
  const { error } = await supabase.from("budget_items").insert({
    wedding_id: wedding.id,
    category,
    label,
    estimated_amount: estimatedAmount,
    actual_amount: actualAmount,
    sourcing,
    suggested_amount: suggestedAmount,
  });

  if (error) {
    console.error("[budget] addBudgetItem:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateBudget();
  return { ok: true };
}

/** Modifie un prestataire existant. */
export async function updateBudgetItem(
  itemId: string,
  input: BudgetItemInput,
): Promise<BudgetActionResult> {
  const id = budgetItemIdSchema.safeParse(itemId);
  const parsed = parseBudgetItem(input);
  if (!id.success || !parsed.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  // Sans ligne renvoyée, la ligne n'existe pas ou la RLS refuse l'écriture.
  // L'indication de Céleste reste celle de la création : elle n'est pas réécrite.
  const { category, label, estimatedAmount, actualAmount, sourcing } = parsed.data;
  const { data, error } = await supabase
    .from("budget_items")
    .update({
      category,
      label,
      sourcing,
      estimated_amount: estimatedAmount,
      actual_amount: actualAmount,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("[budget] updateBudgetItem:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateBudget();
  return { ok: true };
}

/** Retire un prestataire du budget. */
export async function deleteBudgetItem(itemId: string): Promise<BudgetActionResult> {
  const id = budgetItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("budget_items")
    .delete()
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("[budget] deleteBudgetItem:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateBudget();
  return { ok: true };
}

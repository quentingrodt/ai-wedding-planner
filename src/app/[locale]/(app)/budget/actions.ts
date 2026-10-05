"use server";

import { revalidatePath } from "next/cache";
import {
  budgetItemIdSchema,
  budgetLineSchema,
  isEmptyLine,
  type BudgetActionResult,
  type BudgetItem,
  type BudgetLineInput,
  type BudgetLineResult,
} from "@/lib/budget/schema";
import { lineDefinition, SECTION_CATEGORY } from "@/lib/budget/worksheet";
import { getCurrentMemberRole, getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

const COLUMNS =
  "id, category, label, estimated_amount, actual_amount, suggested_amount, sourcing, section, line_key, notes, payer";

// Pattern de route : couvre /budget (fr, sans préfixe) et /en/budget.
// La jauge du tableau de bord lit les mêmes lignes : on la revalide aussi.
const revalidateBudget = () => {
  revalidatePath("/[locale]/(app)/budget", "page");
  revalidatePath("/[locale]/(app)/dashboard", "page");
};

type Writer =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; weddingId: string }
  | { ok: false; error: "unauthenticated" | "forbidden" };

/** Mariage courant, si l'utilisateur en est l'un des mariés (la RLS reste la garantie). */
async function getBudgetWriter(): Promise<Writer> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };
  return { ok: true, supabase, weddingId: wedding.id };
}

/**
 * Enregistre un poste de la grille : création à la première saisie, mise à
 * jour ensuite. Un poste de la grille redevenu vide (sans indication de
 * Céleste) est supprimé : il n'encombre pas la base.
 */
export async function saveBudgetLine(input: BudgetLineInput): Promise<BudgetLineResult> {
  const parsed = budgetLineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const line = parsed.data;
  const definition = line.lineKey ? lineDefinition(line.lineKey) : null;
  if (definition && definition.section !== line.section) return { ok: false, error: "invalid" };

  const writer = await getBudgetWriter();
  if (!writer.ok) return writer;
  const { supabase, weddingId } = writer;

  const values = {
    estimated_amount: line.estimatedAmount,
    actual_amount: line.actualAmount,
    notes: line.notes,
    payer: line.payer,
    sourcing: line.sourcing,
    // Libellé : seulement pour les postes ajoutés par le couple.
    ...(line.lineKey ? {} : { label: line.label }),
  };

  // Retrouve la ligne existante : par id, ou par poste de la grille (double envoi).
  let id = line.id;
  if (!id && line.lineKey) {
    const { data } = await supabase
      .from("budget_items")
      .select("id")
      .eq("wedding_id", weddingId)
      .eq("line_key", line.lineKey)
      .maybeSingle<{ id: string }>();
    id = data?.id ?? null;
  }

  if (id) {
    if (isEmptyLine(line)) {
      const { data: current } = await supabase
        .from("budget_items")
        .select("suggested_amount")
        .eq("id", id)
        .maybeSingle<{ suggested_amount: number | null }>();
      if (current && current.suggested_amount === null) {
        const { error } = await supabase.from("budget_items").delete().eq("id", id);
        if (error) {
          console.error("[budget] saveBudgetLine (delete):", error.code);
          return { ok: false, error: "generic" };
        }
        revalidateBudget();
        return { ok: true, item: null };
      }
    }
    const { data, error } = await supabase
      .from("budget_items")
      .update(values)
      .eq("id", id)
      .eq("wedding_id", weddingId)
      .select(COLUMNS)
      .returns<BudgetItem[]>();
    if (error) {
      console.error("[budget] saveBudgetLine (update):", error.code);
      return { ok: false, error: "generic" };
    }
    if (data.length === 0) return { ok: false, error: "forbidden" };
    revalidateBudget();
    return { ok: true, item: data[0] };
  }

  if (isEmptyLine(line)) return { ok: true, item: null };

  const { data, error } = await supabase
    .from("budget_items")
    .insert({
      ...values,
      wedding_id: weddingId,
      section: line.section,
      line_key: line.lineKey,
      label: line.lineKey ? null : line.label,
      category: definition?.category ?? SECTION_CATEGORY[line.section],
    })
    .select(COLUMNS)
    .returns<BudgetItem[]>();
  if (error) {
    console.error("[budget] saveBudgetLine (insert):", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }
  revalidateBudget();
  return { ok: true, item: data[0] ?? null };
}

/** Retire un poste (ajouté par le couple, ou effacé de la grille). */
export async function deleteBudgetLine(itemId: string): Promise<BudgetActionResult> {
  const id = budgetItemIdSchema.safeParse(itemId);
  if (!id.success) return { ok: false, error: "invalid" };
  const writer = await getBudgetWriter();
  if (!writer.ok) return writer;

  const { data, error } = await writer.supabase
    .from("budget_items")
    .delete()
    .eq("id", id.data)
    .eq("wedding_id", writer.weddingId)
    .select("id");
  if (error) {
    console.error("[budget] deleteBudgetLine:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateBudget();
  return { ok: true };
}

/** La notice « qui paie quoi » a été lue : elle ne s'ouvre plus d'elle-même. */
export async function markBudgetIntroSeen(): Promise<BudgetActionResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ budget_intro_seen_at: new Date().toISOString() })
    .eq("id", userId)
    .is("budget_intro_seen_at", null);
  if (error) {
    console.error("[budget] markBudgetIntroSeen:", error.code);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

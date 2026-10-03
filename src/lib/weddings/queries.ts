import type { BudgetItem } from "@/lib/budget/schema";
import type { Task } from "@/lib/tasks/schema";
import type { createClient } from "@/utils/supabase/client";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Identifiant de l'utilisateur connecté (JWT vérifié), ou null. */
export async function getCurrentUserId(
  supabase: ServerClient,
): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims.sub;
}

export type WeddingSummary = {
  id: string;
  title: string;
  wedding_date: string | null;
  total_budget: number | null;
  currency_code: string;
  guest_count: number | null;
};

/**
 * Premier mariage auquel l'utilisateur a accès (RLS : créateur ou membre).
 * Le multi-projets viendra plus tard : on prend le plus ancien.
 */
export async function getCurrentWedding(
  supabase: ServerClient,
): Promise<WeddingSummary | null> {
  const { data, error } = await supabase
    .from("weddings")
    .select("id, title, wedding_date, total_budget, currency_code, guest_count")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WeddingSummary>();

  if (error) {
    console.error("[weddings] getCurrentWedding:", error.code);
    throw new Error("Unable to load wedding");
  }
  if (!data) return null;
  // numeric(12,2) peut arriver sous forme de chaîne selon la configuration PostgREST.
  return {
    ...data,
    total_budget: data.total_budget === null ? null : Number(data.total_budget),
  };
}

/** Prochaines tâches à faire, de la plus urgente à la plus lointaine. */
export async function getUpcomingTasks(
  supabase: ServerClient,
  weddingId: string,
  limit = 5,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, template_key, title, status, target_offset_days, due_date")
    .eq("wedding_id", weddingId)
    .eq("status", "todo")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("target_offset_days", { ascending: true })
    .limit(limit)
    .returns<Task[]>();

  if (error) {
    console.error("[weddings] getUpcomingTasks:", error.code);
    throw new Error("Unable to load tasks");
  }
  return data;
}

/** Lignes de budget du mariage, dans l'ordre de création. */
export async function getBudgetItems(
  supabase: ServerClient,
  weddingId: string,
): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from("budget_items")
    .select("id, category, label, estimated_amount, actual_amount")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true })
    .returns<BudgetItem[]>();

  if (error) {
    console.error("[weddings] getBudgetItems:", error.code);
    throw new Error("Unable to load budget");
  }
  return data;
}

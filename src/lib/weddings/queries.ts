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

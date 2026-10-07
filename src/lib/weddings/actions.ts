"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import { getCurrentUserId } from "./queries";
import { rememberSelectedWedding } from "./selection";

export type SwitchWeddingResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "invalid" };

/**
 * Affiche un autre mariage de l'utilisateur (le sien, ou celui d'amis dont il
 * est témoin). Refusé s'il n'en est pas membre : le cookie ne mémorise qu'un
 * choix déjà autorisé.
 */
export async function switchWedding(weddingId: string): Promise<SwitchWeddingResult> {
  const parsed = z.uuid().safeParse(weddingId);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("wedding_members")
    .select("wedding_id")
    .eq("user_id", userId)
    .eq("wedding_id", parsed.data)
    .maybeSingle();
  if (error) {
    console.error("[weddings] switchWedding:", error.code);
    return { ok: false, error: "forbidden" };
  }
  if (!data) return { ok: false, error: "forbidden" };

  await rememberSelectedWedding(parsed.data);
  // Toutes les pages de l'espace connecté dépendent du mariage affiché.
  revalidatePath("/", "layout");
  return { ok: true };
}

"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { feedbackSchema, type FeedbackInput, type FeedbackResult } from "./schema";

/** Au plus 10 retours par heure et par personne : de quoi tout dire, pas de quoi inonder. */
const FEEDBACK_HOURLY_LIMIT = 10;

/** Enregistre un retour, avec la page et le mariage affichés à l'envoi. */
export async function sendFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (countError) {
    console.error("[feedback] count:", countError.code);
    return { ok: false, error: "generic" };
  }
  if ((count ?? 0) >= FEEDBACK_HOURLY_LIMIT) return { ok: false, error: "tooMany" };

  const [wedding, locale, userAgent] = await Promise.all([
    getCurrentWedding(supabase).catch(() => null),
    getLocale(),
    headers().then((list) => list.get("user-agent")?.slice(0, 500) ?? null),
  ]);

  const { error } = await supabase.from("feedback").insert({
    wedding_id: wedding?.id ?? null,
    kind: parsed.data.kind,
    message: parsed.data.message,
    page: parsed.data.page,
    locale,
    user_agent: userAgent,
  });
  if (error) {
    console.error("[feedback] insert:", error.code);
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}

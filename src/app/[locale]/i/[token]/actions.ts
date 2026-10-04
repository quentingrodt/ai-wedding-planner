"use server";

import {
  submitRsvpSchema,
  type SubmitRsvpInput,
  type SubmitRsvpResult,
} from "@/lib/rsvp/schema";
import { createClient } from "@/utils/supabase/client";

/**
 * Réponse d'un invité depuis son lien personnel, sans compte : la RPC
 * submit_guest_rsvp (SECURITY DEFINER) ne modifie que l'invité du jeton.
 */
export async function submitRsvp(input: SubmitRsvpInput): Promise<SubmitRsvpResult> {
  const parsed = submitRsvpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { token, status, dietary } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_guest_rsvp", {
    p_token: token,
    p_status: status,
    // Un invité qui décline n'a pas de régime à transmettre.
    p_dietary: status === "declined" ? null : dietary || null,
  });

  if (error) {
    console.error("[rsvp] submit_guest_rsvp:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data === "saved") return { ok: true, status };
  if (data === "closed") return { ok: false, error: "closed" };
  return { ok: false, error: "invalid" };
}

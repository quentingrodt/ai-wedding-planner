"use server";

import { revalidatePath } from "next/cache";
import {
  invitationDesignSchema,
  type InvitationDesign,
  type SaveInvitationResult,
} from "@/lib/invitations/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/**
 * Enregistre le design du faire-part (owner ou partner). Mise à jour, puis
 * création s'il n'existe pas : un upsert réécrirait wedding_id, colonne que
 * la table ne laisse pas modifier.
 */
export async function saveInvitation(input: InvitationDesign): Promise<SaveInvitationResult> {
  const parsed = invitationDesignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  // Vérification d'UX : la RLS reste la garantie réelle.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };

  const { data: updated, error: updateError } = await supabase
    .from("invitations")
    .update({ design: parsed.data, updated_at: new Date().toISOString() })
    .eq("wedding_id", wedding.id)
    .select("id");

  if (updateError) {
    console.error("[invitations] update:", updateError.code);
    return { ok: false, error: updateError.code === "42501" ? "forbidden" : "generic" };
  }

  if (updated.length === 0) {
    const { error: insertError } = await supabase
      .from("invitations")
      .insert({ wedding_id: wedding.id, design: parsed.data });
    if (insertError) {
      console.error("[invitations] insert:", insertError.code);
      return { ok: false, error: insertError.code === "42501" ? "forbidden" : "generic" };
    }
  }

  revalidatePath("/[locale]/invitations", "page");
  return { ok: true };
}

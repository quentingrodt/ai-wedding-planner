"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { inviteTokenSchema, type AcceptInviteState } from "@/lib/team/schema";
import { getCurrentUserId, getLatestMembershipWeddingId } from "@/lib/weddings/queries";
import { rememberSelectedWedding } from "@/lib/weddings/selection";
import { createClient } from "@/utils/supabase/client";

/**
 * Rejoint le mariage associé au token (fonction SQL atomique : ajout du membre
 * puis suppression du token), puis redirige vers le tableau de bord.
 */
export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = inviteTokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { status: "error", code: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_wedding_invite", {
    p_token: parsed.data,
  });

  if (error) {
    console.error("[team] acceptInvite:", error.code);
    return { status: "error", code: "generic" };
  }

  const status = String(data);
  if (status === "joined") {
    // Le mariage rejoint devient le mariage affiché, même si l'invité a déjà le sien.
    const userId = await getCurrentUserId(supabase);
    const weddingId = userId ? await getLatestMembershipWeddingId(supabase, userId).catch(() => null) : null;
    if (weddingId) await rememberSelectedWedding(weddingId);
  }
  if (status === "joined" || status === "already_member") {
    return redirect({ href: "/dashboard", locale: await getLocale() });
  }
  if (status === "unauthenticated" || status === "expired" || status === "invalid") {
    return { status: "error", code: status };
  }
  return { status: "error", code: "generic" };
}

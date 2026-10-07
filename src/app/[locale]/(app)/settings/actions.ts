"use server";

import { getLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { getRequestOrigin } from "@/lib/auth/redirect";
import { inviteRoleSchema, type GenerateInviteResult } from "@/lib/team/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Crée un lien d'invitation (conjoint ou témoin) pour le mariage courant. Owner uniquement. */
export async function generateInvite(role: string): Promise<GenerateInviteResult> {
  const parsed = inviteRoleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  // Vérification d'UX : la RLS reste la garantie réelle.
  if ((await getCurrentMemberRole(supabase, wedding.id, userId)) !== "owner") {
    return { ok: false, error: "forbidden" };
  }

  const { data, error } = await supabase
    .from("wedding_invites")
    .insert({ wedding_id: wedding.id, role: parsed.data })
    .select("token, expires_at")
    .single<{ token: string; expires_at: string }>();

  if (error) {
    console.error("[team] generateInvite:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  const origin = await getRequestOrigin();
  const locale = await getLocale();
  const path = getPathname({ href: `/invite/${data.token}`, locale });

  return { ok: true, url: `${origin}${path}`, expiresAt: data.expires_at };
}

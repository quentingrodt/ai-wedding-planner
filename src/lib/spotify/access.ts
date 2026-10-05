import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  type WeddingSummary,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/**
 * Mariage courant, si l'utilisateur connecté en est l'un des mariés : seuls
 * owner et partner lient un compte Spotify et remplissent la playlist.
 * Toujours appelé avant de toucher aux jetons (client service_role).
 */
export async function getCoupleWedding(): Promise<
  { ok: true; wedding: WeddingSummary } | { ok: false; error: "unauthenticated" | "forbidden" }
> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };

  return { ok: true, wedding };
}

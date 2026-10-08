import { MOODBOARD_BUCKET } from "@/lib/moodboard/schema";
import { WEDDING_PHOTO_BUCKET } from "@/lib/weddings/photo";
import type { WeddingRole } from "@/lib/weddings/queries";
import type { createAdminClient } from "@/utils/supabase/admin";
import { planAccountDeletion, type DeletionPlan, type WeddingWithMembers } from "./deletion-plan";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Buckets rangés par dossier de mariage : « <wedding_id>/<fichier> ». */
const WEDDING_BUCKETS = [WEDDING_PHOTO_BUCKET, MOODBOARD_BUCKET];

/** Ce que deviendrait chaque mariage de la personne si elle supprimait son compte. */
export async function loadDeletionPlan(admin: AdminClient, userId: string): Promise<DeletionPlan> {
  const { data: memberships, error } = await admin
    .from("wedding_members")
    .select("wedding_id")
    .eq("user_id", userId)
    .returns<{ wedding_id: string }[]>();
  if (error) throw new Error(`memberships: ${error.code}`);
  if (memberships.length === 0) return { deleted: [], kept: [], left: [] };

  const { data: weddings, error: weddingsError } = await admin
    .from("weddings")
    .select("id, title, wedding_members(user_id, role)")
    .in(
      "id",
      memberships.map((membership) => membership.wedding_id),
    )
    .returns<{ id: string; title: string; wedding_members: { user_id: string; role: WeddingRole }[] }[]>();
  if (weddingsError) throw new Error(`weddings: ${weddingsError.code}`);

  const withMembers: WeddingWithMembers[] = weddings.map(({ id, title, wedding_members }) => ({
    id,
    title,
    members: wedding_members,
  }));
  return planAccountDeletion(userId, withMembers);
}

/** Supprime tous les fichiers d'un mariage dans un bucket, page par page. */
async function emptyWeddingFolder(admin: AdminClient, bucket: string, weddingId: string) {
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(weddingId, { limit: 1000 });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    if (data.length === 0) return;
    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(data.map((file) => `${weddingId}/${file.name}`));
    if (removeError) throw new Error(`remove ${bucket}: ${removeError.message}`);
    if (data.length < 1000) return;
  }
}

/**
 * Applique le plan puis efface le compte. Chaque étape peut être rejouée :
 * si l'une échoue, une nouvelle demande reprend là où la précédente s'est
 * arrêtée. Le compte n'est effacé qu'en dernier.
 */
export async function deleteAccountData(admin: AdminClient, userId: string): Promise<void> {
  const plan = await loadDeletionPlan(admin, userId);

  // 1. L'autre marié devient propriétaire avant que la personne parte.
  for (const wedding of plan.kept) {
    if (!wedding.promote) continue;
    const { error } = await admin
      .from("wedding_members")
      .update({ role: "owner" })
      .eq("wedding_id", wedding.id)
      .eq("user_id", wedding.promote);
    if (error) throw new Error(`promote: ${error.code}`);
  }

  // 2. Mariages sans autre marié : fichiers puis données (cascade en base).
  for (const wedding of plan.deleted) {
    for (const bucket of WEDDING_BUCKETS) await emptyWeddingFolder(admin, bucket, wedding.id);
    const { error } = await admin.from("weddings").delete().eq("id", wedding.id);
    if (error) throw new Error(`delete wedding: ${error.code}`);
  }

  // 3. Le compte : profil, adhésions et contenus personnels suivent en cascade.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete user: ${error.message}`);
}

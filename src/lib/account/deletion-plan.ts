import type { WeddingRole } from "@/lib/weddings/queries";

/*
 * Suppression de compte (RGPD, droit à l'effacement) : ce que devient
 * chaque mariage dont la personne est membre. Calcul pur, testé à part.
 *
 * - Elle s'y marie et l'autre marié a un compte : le mariage reste, pour
 *   lui ; il en devient propriétaire si elle l'était.
 * - Elle est seule à s'y marier : le mariage est supprimé, avec ses
 *   fichiers ; les témoins perdent l'accès.
 * - Elle y est témoin : elle le quitte, le mariage ne change pas.
 */

export type WeddingWithMembers = {
  id: string;
  title: string;
  members: { user_id: string; role: WeddingRole }[];
};

export type DeletionPlan = {
  /** Supprimés entièrement : la personne y était seule à se marier. */
  deleted: { id: string; title: string }[];
  /** Conservés pour l'autre marié ; promote : nouveau propriétaire, si besoin. */
  kept: { id: string; title: string; promote: string | null }[];
  /** Mariages où la personne était témoin : elle les quitte. */
  left: { id: string; title: string }[];
};

const isCouple = (role: WeddingRole) => role === "owner" || role === "partner";

export function planAccountDeletion(userId: string, weddings: WeddingWithMembers[]): DeletionPlan {
  const plan: DeletionPlan = { deleted: [], kept: [], left: [] };
  for (const wedding of weddings) {
    const self = wedding.members.find((member) => member.user_id === userId);
    if (!self) continue;
    const { id, title } = wedding;
    if (!isCouple(self.role)) {
      plan.left.push({ id, title });
      continue;
    }
    const others = wedding.members.filter((member) => member.user_id !== userId && isCouple(member.role));
    if (others.length === 0) {
      plan.deleted.push({ id, title });
      continue;
    }
    const ownerRemains = others.some((member) => member.role === "owner");
    plan.kept.push({ id, title, promote: ownerRemains ? null : others[0].user_id });
  }
  return plan;
}

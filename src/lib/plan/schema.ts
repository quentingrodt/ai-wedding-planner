import { z } from "zod";
import { PLAN_VENDORS } from "./allocation";

/**
 * Sortie structurée de l'agent de plan : uniquement du texte rédigé. Les
 * montants viennent de allocateBudget (TypeScript) et sont joints par poste
 * à l'affichage ; l'agent ne produit aucun chiffre de budget.
 */
export const weddingPlanSchema = z.object({
  vision: z.object({
    /** Titre évocateur de l'identité du mariage. */
    title: z.string(),
    /** Synthèse de l'ADN du mariage en quelques phrases. */
    summary: z.string(),
  }),
  /** Une recommandation par poste activé dans la répartition. */
  recommendations: z.array(
    z.object({
      vendor: z.enum(PLAN_VENDORS),
      /** Proposition concrète, cohérente avec les choix du carnet. */
      proposal: z.string(),
      /** Types de prestataires ou critères à rechercher. */
      lookFor: z.array(z.string()),
      /** Quand réserver ou s'en occuper, relatif à la date du mariage. */
      when: z.string(),
      /** Astuce pour tenir l'enveloppe allouée. */
      budgetTip: z.string(),
    }),
  ),
  /** Grandes étapes, de la plus lointaine à la plus proche du jour J. */
  milestones: z.array(z.object({ when: z.string(), action: z.string() })),
  /** Idées à transmettre aux témoins pour l'EVJF et l'EVG. */
  witnesses: z.object({ bachelorette: z.string(), bachelor: z.string() }),
});
export type WeddingPlan = z.infer<typeof weddingPlanSchema>;

/** Répartition stockée avec le plan (relue depuis wedding_plans.allocation). */
export const planAllocationSchema = z.object({
  total: z.number(),
  contingency: z.number(),
  lines: z.array(z.object({ vendor: z.enum(PLAN_VENDORS), amount: z.number() })),
});

/** Plan prêt à afficher : texte rédigé, montants calculés et date. */
export type StoredWeddingPlan = {
  plan: WeddingPlan;
  allocation: z.infer<typeof planAllocationSchema>;
  createdAt: string;
};

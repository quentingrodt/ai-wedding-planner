import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Locale } from "next-intl";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { INSPIRATION_SECTIONS, type InspirationLikes } from "@/lib/inspiration/catalog";
import type { PlanAllocation } from "@/lib/plan/allocation";
import { weddingPlanSchema, type WeddingPlan } from "@/lib/plan/schema";

/** Génération textuelle : Claude Haiku 4.5 (cf. docs/ARCHITECTURE.md). */
export const WEDDING_PLAN_MODEL = "claude-haiku-4-5";

/** Aucune clé d'API configurée : la génération est indisponible. */
export class AiUnavailableError extends Error {}
/** Réponse inexploitable (refus, sortie tronquée ou hors schéma). */
export class AiGenerationError extends Error {}

const LANGUAGE_NAMES: Record<Locale, string> = { fr: "français", en: "anglais" };

// Prompt système figé (préfixe stable) : le contexte du couple va dans le message.
const SYSTEM_PROMPT = `Tu es le copilote de Céleste, une application qui accompagne les futurs mariés dans l'organisation de leur mariage.

À partir du carnet d'inspiration d'un couple (ses coups de cœur) et d'une répartition de budget déjà calculée, tu rédiges un plan d'accompagnement concret et réaliste.

Règles :
- Rédige une recommandation par poste de la répartition, en reprenant exactement sa clé (champ vendor).
- N'invente aucun montant, pourcentage ni prix : les chiffres sont fournis et affichés à part. Raisonne à partir des enveloppes données.
- Reste réaliste pour le marché indiqué : délais de réservation usuels, saisonnalité, pratiques courantes.
- Ne cite aucun prestataire, lieu ou marque réels : décris des types de prestataires et des critères de choix.
- Sois cohérent avec l'ensemble des choix (ambiance, cérémonie, repas, tenues…) et propose un fil conducteur.
- Pour l'EVJF et l'EVG, donne aux témoins des idées concrètes fidèles aux coups de cœur, sans budget.
- Ton chaleureux, élégant et pratique, en vouvoyant le couple ; phrases courtes, pas de jargon.`;

export type WeddingPlanAgentInput = {
  locale: Locale;
  likes: InspirationLikes;
  allocation: PlanAllocation;
  currency: string;
  guests: number | null;
  weddingDate: string | null;
};

export type WeddingPlanAgentResult = {
  plan: WeddingPlan;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

/**
 * Agent sans état : rédige le plan d'accompagnement à partir du carnet et de
 * montants calculés en TypeScript. Il ne calcule rien lui-même.
 */
export async function runWeddingPlanAgent(
  input: WeddingPlanAgentInput,
): Promise<WeddingPlanAgentResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiUnavailableError("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: WEDDING_PLAN_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: await describeCouple(input) }],
    output_config: { format: zodOutputFormat(weddingPlanSchema) },
  });

  if (response.stop_reason !== "end_turn" || !response.parsed_output) {
    throw new AiGenerationError(`Unusable response: ${response.stop_reason}`);
  }

  // L'agent ne doit commenter que les postes réellement financés.
  const funded = new Set(input.allocation.lines.map((line) => line.vendor));
  const plan: WeddingPlan = {
    ...response.parsed_output,
    recommendations: response.parsed_output.recommendations.filter((r) => funded.has(r.vendor)),
  };

  return {
    plan,
    model: WEDDING_PLAN_MODEL,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/** Contexte du couple en langage naturel, dans la langue de rédaction. */
async function describeCouple({
  locale,
  likes,
  allocation,
  currency,
  guests,
  weddingDate,
}: WeddingPlanAgentInput): Promise<string> {
  const messages = await getMessages({ locale });
  const tVendors = await getTranslations({ locale, namespace: "Plan.vendors" });
  const tSections = await getTranslations({ locale, namespace: "Inspiration.book.sections" });
  const format = await getFormatter({ locale });
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });

  const steps = messages.Inspiration.steps as Record<string, { label: string }>;
  const options = messages.Inspiration.options as Record<string, Record<string, { name: string }>>;

  const choices = INSPIRATION_SECTIONS.map((section) => {
    const lines = section.steps.map((step) => {
      const names = (likes[step] ?? []).map((option) => options[step][option].name);
      return `- ${steps[step].label} : ${names.length > 0 ? names.join(", ") : "aucun coup de cœur"}`;
    });
    return `${tSections(section.key)}\n${lines.join("\n")}`;
  });

  const budget = allocation.lines.map(
    (line) => `- ${line.vendor} (${tVendors(line.vendor)}) : ${money(line.amount)}`,
  );

  return [
    `Langue de rédaction : ${LANGUAGE_NAMES[locale]}.`,
    `Marché : France (${currency}).`,
    `Date du mariage : ${weddingDate ?? "pas encore fixée"}.`,
    `Nombre d'invités : ${guests ?? "pas encore connu"}.`,
    "",
    "Carnet d'inspiration :",
    choices.join("\n\n"),
    "",
    `Répartition du budget total de ${money(allocation.total)} (dont ${money(allocation.contingency)} réservés aux imprévus, non répartis) :`,
    budget.join("\n"),
  ].join("\n");
}

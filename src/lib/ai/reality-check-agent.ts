import type { Locale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  DATE_NIGHT_CURRENCY,
  realityCheckInsightSchema,
  type DateNightInput,
  type Feasibility,
  type RealityCheckInsight,
} from "@/lib/date-night/schema";

const SIMULATED_LATENCY_MS = 2_000;

type RealityCheckAgentInput = DateNightInput & {
  feasibility: Feasibility;
  locale: Locale;
};

/**
 * Agent sans état : rédige le "Reality Check" à partir de chiffres déjà
 * calculés en TypeScript. Il ne calcule rien lui-même.
 *
 * SIMULATION : la rédaction vient pour l'instant du dictionnaire. Le
 * branchement sur Claude Haiku 4.5 gardera cette signature et ce schéma.
 */
export async function runRealityCheckAgent({
  style,
  budget,
  guests,
  feasibility,
  locale,
}: RealityCheckAgentInput): Promise<RealityCheckInsight> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  const t = await getTranslations({ locale, namespace: "RealityCheckAgent" });
  const format = await getFormatter({ locale });

  const { verdict } = feasibility;
  const values = {
    budget: format.number(budget, {
      style: "currency",
      currency: DATE_NIGHT_CURRENCY,
      maximumFractionDigits: 0,
    }),
    guests,
    setting: t(`settings.${style}`),
    coverage: format.number(feasibility.coverage, {
      style: "percent",
      maximumFractionDigits: 0,
    }),
    affordableGuests: feasibility.affordableGuests,
  };

  // Budget confortable : deux pistes pour sublimer.
  // Sinon : une astuce liée au verdict, une liée à l'ambiance choisie.
  const tips =
    verdict === "comfortable"
      ? [
          { title: t("tips.comfortable.experience.title"), body: t("tips.comfortable.experience.body") },
          { title: t("tips.comfortable.reserve.title"), body: t("tips.comfortable.reserve.body") },
        ]
      : [
          { title: t(`tips.${verdict}.title`), body: t(`tips.${verdict}.body`, values) },
          { title: t(`styleTips.${style}.title`), body: t(`styleTips.${style}.body`) },
        ];

  return realityCheckInsightSchema.parse({
    headline: t(`headlines.${verdict}`, values),
    summary: t(`summaries.${verdict}`, values),
    tips,
  });
}

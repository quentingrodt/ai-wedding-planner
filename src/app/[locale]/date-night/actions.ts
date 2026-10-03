"use server";

import { getLocale } from "next-intl/server";
import { runRealityCheckAgent } from "@/lib/ai/reality-check-agent";
import { assessFeasibility } from "@/lib/date-night/feasibility";
import {
  dateNightInputSchema,
  type RealityCheckResponse,
} from "@/lib/date-night/schema";

/** Reality Check du tunnel public "Date Night" (aucune écriture en base). */
export async function analyzeDateNight(
  input: unknown,
): Promise<RealityCheckResponse> {
  const parsed = dateNightInputSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", code: "invalidInput" };
  }

  const feasibility = assessFeasibility(parsed.data);

  try {
    const insight = await runRealityCheckAgent({
      ...parsed.data,
      feasibility,
      locale: await getLocale(),
    });
    return { status: "success", input: parsed.data, feasibility, insight };
  } catch (error) {
    console.error("[date-night] reality check:", error);
    return { status: "error", code: "generic" };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import type { Locale } from "next-intl";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import {
  INSPIRATION_STEPS,
  inspirationLikesSchema,
  type InspirationStep,
} from "@/lib/inspiration/catalog";
import { weddingPaletteSchema } from "@/lib/inspiration/palette";
import { playedSteps, type StyleDna } from "@/lib/inspiration/style-dna";
import {
  AiUnavailableError,
  runWeddingPlanAgent,
  type WeddingPlanAgentResult,
} from "@/lib/ai/wedding-plan-agent";
import { allocateBudget } from "@/lib/plan/allocation";
import type { StoredWeddingPlan } from "@/lib/plan/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getLatestWeddingPlan,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

export type InspirationActionResult =
  { ok: true } | { ok: false; error: "invalid" | "unauthenticated" | "forbidden" | "generic" };

const stepSchema = z.enum(INSPIRATION_STEPS as [InspirationStep, ...InspirationStep[]]);

/**
 * Enregistre les coups de cœur d'une étape du carnet dans le Style DNA du
 * mariage courant (owner ou partner). Lecture puis réécriture de l'objet
 * JSON : les autres étapes sont conservées telles quelles.
 */
export async function saveInspirationStep(
  rawStep: string,
  rawLikes: readonly string[],
): Promise<InspirationActionResult> {
  const step = stepSchema.safeParse(rawStep);
  if (!step.success) return { ok: false, error: "invalid" };
  const likes = inspirationLikesSchema.shape[step.data].safeParse(rawLikes);
  if (!likes.success || likes.data === undefined) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  // Vérification d'UX : la RLS reste la garantie réelle.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }

  let current: StyleDna;
  try {
    current = await getWeddingStyleDna(supabase, wedding.id);
  } catch {
    return { ok: false, error: "generic" };
  }

  const nextLikes = { ...current.likes, [step.data]: likes.data };
  // Le reste du Style DNA (palette…) est conservé tel quel.
  const next: StyleDna = {
    ...current,
    version: 2,
    // Sans ambiance de référence (Style DNA ancien ou vide), le premier lieu aimé la fixe.
    ambiance: current.ambiance ?? nextLikes.venue?.[0],
    likes: nextLikes,
  };

  const { data, error } = await supabase
    .from("weddings")
    .update({ style_dna: next })
    .eq("id", wedding.id)
    .select("id");

  if (error) {
    console.error("[inspiration] saveInspirationStep:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }
  // Sans ligne renvoyée, la RLS a refusé l'écriture.
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/[locale]/(app)/dashboard", "page");
  return { ok: true };
}

/**
 * Enregistre l'identité visuelle (couleurs choisies, dans l'ordre) dans le
 * Style DNA du mariage courant. Une liste vide efface la palette.
 */
export async function saveWeddingPalette(
  rawColors: readonly string[],
): Promise<InspirationActionResult> {
  const palette =
    rawColors.length === 0 ? null : weddingPaletteSchema.safeParse({ colors: rawColors });
  if (palette && !palette.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }

  let current: StyleDna;
  try {
    current = await getWeddingStyleDna(supabase, wedding.id);
  } catch {
    return { ok: false, error: "generic" };
  }
  const next: StyleDna = { ...current, palette: palette?.data };

  const { data, error } = await supabase
    .from("weddings")
    .update({ style_dna: next })
    .eq("id", wedding.id)
    .select("id");

  if (error) {
    console.error("[inspiration] saveWeddingPalette:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/[locale]/(app)/inspiration/palette", "page");
  return { ok: true };
}

export type PlanActionResult =
  | { ok: true; plan: StoredWeddingPlan }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "forbidden"
        | "incomplete"
        | "noBudget"
        | "tooSoon"
        | "unavailable"
        | "generic";
    };

/** Délai minimal entre deux générations, pour éviter les doubles clics coûteux. */
const PLAN_COOLDOWN_MS = 60_000;

/**
 * Prépare le plan d'accompagnement : répartition du budget calculée en
 * TypeScript, rédaction par l'agent, puis enregistrement dans wedding_plans.
 * Réservé à owner et partner, une fois les 12 étapes du carnet jouées.
 */
export async function generateWeddingPlan(): Promise<PlanActionResult> {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };

  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };

  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return { ok: false, error: "forbidden" };
  }
  if (wedding.total_budget === null || wedding.total_budget <= 0) {
    return { ok: false, error: "noBudget" };
  }

  let styleDna: StyleDna;
  let latest: StoredWeddingPlan | null;
  try {
    [styleDna, latest] = await Promise.all([
      getWeddingStyleDna(supabase, wedding.id),
      getLatestWeddingPlan(supabase, wedding.id),
    ]);
  } catch {
    return { ok: false, error: "generic" };
  }
  if (playedSteps(styleDna.likes).length < INSPIRATION_STEPS.length) {
    return { ok: false, error: "incomplete" };
  }
  if (latest && Date.now() - Date.parse(latest.createdAt) < PLAN_COOLDOWN_MS) {
    return { ok: false, error: "tooSoon" };
  }

  const locale = (await getLocale()) as Locale;
  const allocation = allocateBudget(wedding.total_budget, styleDna.likes);

  let result: WeddingPlanAgentResult;
  try {
    result = await runWeddingPlanAgent({
      locale,
      likes: styleDna.likes,
      allocation,
      currency: wedding.currency_code,
      guests: wedding.guest_count,
      weddingDate: wedding.wedding_date,
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) return { ok: false, error: "unavailable" };
    console.error("[plan] runWeddingPlanAgent:", error instanceof Error ? error.message : error);
    return { ok: false, error: "generic" };
  }

  const { data, error } = await supabase
    .from("wedding_plans")
    .insert({
      wedding_id: wedding.id,
      locale,
      model: result.model,
      style_dna: styleDna,
      allocation,
      plan: result.plan,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
    })
    .select("created_at")
    .single<{ created_at: string }>();

  // Le plan est rendu même si l'enregistrement échoue : il ne sera simplement pas conservé.
  if (error) console.error("[plan] insert wedding_plans:", error.code);

  return {
    ok: true,
    plan: {
      plan: result.plan,
      allocation,
      createdAt: data?.created_at ?? new Date().toISOString(),
    },
  };
}

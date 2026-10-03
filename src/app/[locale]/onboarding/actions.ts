"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  onboardingSchema,
  type OnboardingField,
  type OnboardingFieldError,
  type OnboardingState,
  type StyleDna,
} from "@/lib/onboarding/schema";
import { getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { seedWeddingDefaults } from "@/lib/weddings/seed";
import { createClient } from "@/utils/supabase/client";

const FIELDS = [
  "coupleNames",
  "weddingDate",
  "budget",
  "guests",
  "style",
] as const satisfies readonly OnboardingField[];

const FIELD_ERRORS = new Set<OnboardingFieldError>([
  "required",
  "tooLong",
  "invalidDate",
  "pastDate",
  "invalidNumber",
  "budgetRange",
  "guestsRange",
]);

function toFieldError(message: string): OnboardingFieldError {
  return FIELD_ERRORS.has(message as OnboardingFieldError)
    ? (message as OnboardingFieldError)
    : "required";
}

/** Crée le projet de mariage ; le trigger SQL ajoute l'utilisateur comme owner. */
export async function createWedding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const locale = await getLocale();

  const values = Object.fromEntries(
    FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as Record<OnboardingField, string>;

  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<OnboardingField, OnboardingFieldError>> =
      {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as OnboardingField;
      fieldErrors[field] ??= toFieldError(issue.message);
    }
    return { status: "error", code: "invalidInput", fieldErrors, values };
  }
  const input = parsed.data;

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return redirect({ href: "/login", locale });
  }

  // Double soumission ou onglet resté ouvert : pas de second projet.
  let alreadyOnboarded: boolean;
  try {
    alreadyOnboarded = (await getCurrentWedding(supabase)) !== null;
  } catch {
    return { status: "error", code: "generic", values };
  }
  if (alreadyOnboarded) {
    return redirect({ href: "/dashboard", locale });
  }

  const styleDna: StyleDna = { version: 1, ambiance: input.style };

  // created_by est rempli par défaut (auth.uid()) et contrôlé par la RLS.
  const { data: wedding, error } = await supabase
    .from("weddings")
    .insert({
      title: input.coupleNames,
      wedding_date: input.weddingDate,
      total_budget: input.budget,
      guest_count: input.guests,
      currency_code: DEFAULT_CURRENCY,
      country_code: DEFAULT_COUNTRY,
      style_dna: styleDna,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    // Message brut journalisé côté serveur uniquement, jamais affiché.
    console.error("[onboarding] insert wedding:", error.code);
    return { status: "error", code: "generic", values };
  }

  // Non bloquant : un échec est journalisé, le dashboard gère l'état vide.
  await seedWeddingDefaults(
    supabase,
    {
      id: wedding.id,
      wedding_date: input.weddingDate,
      total_budget: input.budget,
    },
    locale,
  ).catch((seedError: unknown) => {
    console.error("[onboarding] seed defaults:", seedError);
  });

  return redirect({ href: "/dashboard", locale });
}

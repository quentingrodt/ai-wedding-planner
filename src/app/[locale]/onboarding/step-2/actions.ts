"use server";

import { revalidatePath } from "next/cache";
import { saveVendor } from "@/app/[locale]/(app)/vendors/actions";
import { saveVenue } from "@/app/[locale]/(app)/venues/actions";
import { addPinterestBoard } from "@/app/[locale]/(app)/inspiration/planche/actions";
import { DEFAULT_GUEST_EVENTS } from "@/lib/guests/schema";
import {
  mergePlanningAnswers,
  parseGuestList,
  STEP_TWO_LIMITS,
  STEP_TWO_VENDORS,
  stepTwoSchema,
  venueNames,
  type StepTwoBlock,
  type StepTwoFieldError,
  type StepTwoInput,
  type StepTwoResult,
} from "@/lib/onboarding/step-two";
import { savePlanningAnswers } from "@/lib/planning/actions";
import type { VendorInput } from "@/lib/vendors/schema";
import type { VenueInput } from "@/lib/venues/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningSetup,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

/** Fiche de lieu réduite à son nom : le reste se complète depuis la page Lieux. */
const venueFromName = (name: string): VenueInput => ({
  name,
  status: "idea",
  url: "",
  visitDate: "",
  location: "",
  travelMinutes: null,
  capacity: null,
  price: null,
  style: null,
  beds: null,
  accommodationNote: "",
  catering: null,
  curfew: "",
  restrictions: "",
  dateStatus: null,
  datesNote: "",
  ratings: {},
  pros: [],
  cons: [],
  notes: "",
});

/** Piste en discussion, avec son budget estimé comme prix total. */
const vendorFromStepTwo = (name: string, budget: number | null): VendorInput => ({
  name,
  status: "contacted",
  contactName: "",
  phone: "",
  email: "",
  url: "",
  location: "",
  price: budget,
  priceBasis: "total",
  deposit: null,
  depositDue: "",
  depositPaid: false,
  secondPayment: null,
  secondDue: "",
  secondPaid: false,
  balanceDue: "",
  balancePaid: false,
  details: {},
  meetingDate: "",
  rating: null,
  pros: [],
  cons: [],
  notes: "",
});

/**
 * Enregistre l'étape 2 : rétroplanning recalibré, tableau Pinterest, lieux
 * en tête, prestataires en discussion et premiers invités. Chaque bloc est
 * indépendant : un échec n'empêche pas les autres, et l'écran dit lesquels
 * reprendre. Réservé aux mariés.
 */
export async function saveStepTwo(input: StepTwoInput): Promise<StepTwoResult> {
  const parsed = stepTwoSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, StepTwoFieldError> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= (["invalidPinterest", "invalidAmount", "tooLong"] as const).includes(
        issue.message as never,
      )
        ? (issue.message as StepTwoFieldError)
        : "tooLong";
    }
    return { ok: false, error: "invalid", fieldErrors };
  }
  const data = parsed.data;
  const guests = data.guests.enabled ? parseGuestList(data.guests.list) : [];
  if (guests.length > STEP_TWO_LIMITS.guests) {
    return { ok: false, error: "invalid", fieldErrors: { "guests.list": "tooManyGuests" } };
  }

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return { ok: false, error: "unauthenticated" };
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) return { ok: false, error: "forbidden" };
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") return { ok: false, error: "forbidden" };

  const failed: StepTwoBlock[] = [];

  // Bloc 1 : le questionnaire du rétroplanning, qui recompose les étapes.
  try {
    const { answers } = await getPlanningSetup(supabase, wedding.id);
    const saved = await savePlanningAnswers(mergePlanningAnswers(answers, data.planning));
    if (!saved.ok) failed.push("planning");
  } catch {
    failed.push("planning");
  }

  // Bloc 2 : le tableau Pinterest rejoint la planche d'inspiration.
  if (data.pinterestUrl) {
    const added = await addPinterestBoard(data.pinterestUrl).catch(() => ({ ok: false as const, error: "generic" }));
    // Déjà lié (double envoi) : rien à reprendre.
    if (!added.ok && added.error !== "duplicate") failed.push("pinterest");
  }

  // Bloc 3 : les lieux en tête, au statut « repéré ».
  if (data.venues.enabled) {
    for (const name of venueNames(data.venues.names)) {
      const saved = await saveVenue(null, venueFromName(name)).catch(() => ({ ok: false as const }));
      if (!saved.ok && !failed.includes("venues")) failed.push("venues");
    }
  }

  // Bloc 4 : les prestataires déjà en vue, au statut « contacté ».
  for (const category of STEP_TWO_VENDORS) {
    const vendor = data.vendors[category];
    if (!vendor.enabled || vendor.name === "") continue;
    const saved = await saveVendor(category, null, vendorFromStepTwo(vendor.name, vendor.budget)).catch(() => ({
      ok: false as const,
    }));
    if (!saved.ok && !failed.includes("vendors")) failed.push("vendors");
  }

  // Bloc 5 : les premiers invités, en une seule insertion.
  if (guests.length > 0) {
    const { error } = await supabase.from("guests").insert(
      guests.map((guest) => ({
        wedding_id: wedding.id,
        first_name: guest.firstName,
        last_name: guest.lastName,
        status: "invited",
        is_child: false,
        events: [...DEFAULT_GUEST_EVENTS],
      })),
    );
    if (error) {
      console.error("[onboarding] step 2 guests:", error.code);
      failed.push("guests");
    } else {
      revalidatePath("/[locale]/(app)/guests", "page");
    }
  }

  revalidatePath("/[locale]/(app)/dashboard", "page");
  return failed.length === 0 ? { ok: true } : { ok: false, error: "partial", failed };
}

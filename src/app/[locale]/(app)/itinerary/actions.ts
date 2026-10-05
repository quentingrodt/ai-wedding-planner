"use server";

import { revalidatePath } from "next/cache";
import {
  eventIdSchema,
  parseEvent,
  type EventInput,
  type ItineraryActionResult,
} from "@/lib/itinerary/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

// Pattern de route : couvre /itinerary (fr, sans préfixe) et /en/itinerary.
const revalidateItinerary = () => revalidatePath("/[locale]/(app)/itinerary", "page");

/** Ajoute une étape au conducteur du mariage courant (owner ou partner). */
export async function addEvent(input: EventInput): Promise<ItineraryActionResult> {
  const parsed = parseEvent(input);
  if (!parsed.ok) return { ok: false, error: "invalid" };

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

  const { startTime, title, location, description } = parsed.data;
  const { error } = await supabase.from("itinerary_events").insert({
    wedding_id: wedding.id,
    start_time: startTime,
    title,
    location,
    description,
  });

  if (error) {
    console.error("[itinerary] addEvent:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateItinerary();
  return { ok: true };
}

/** Modifie une étape existante. */
export async function updateEvent(
  eventId: string,
  input: EventInput,
): Promise<ItineraryActionResult> {
  const id = eventIdSchema.safeParse(eventId);
  const parsed = parseEvent(input);
  if (!id.success || !parsed.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  // Sans ligne renvoyée, l'étape n'existe pas ou la RLS refuse l'écriture
  // (un témoin peut lire la ligne mais pas la modifier).
  const { startTime, title, location, description } = parsed.data;
  const { data, error } = await supabase
    .from("itinerary_events")
    .update({ start_time: startTime, title, location, description })
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("[itinerary] updateEvent:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateItinerary();
  return { ok: true };
}

/** Retire une étape du conducteur. */
export async function deleteEvent(eventId: string): Promise<ItineraryActionResult> {
  const id = eventIdSchema.safeParse(eventId);
  if (!id.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("itinerary_events")
    .delete()
    .eq("id", id.data)
    .select("id");

  if (error) {
    console.error("[itinerary] deleteEvent:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateItinerary();
  return { ok: true };
}

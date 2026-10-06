"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import {
  parseCalendarEvent,
  type CalendarActionResult,
  type CalendarEventData,
  type CalendarEventInput,
} from "./schema";

// Pattern de route : couvre /calendar (fr, sans préfixe) et /en/calendar.
const revalidateCalendar = () => revalidatePath("/[locale]/(app)/calendar", "page");

const toRow = ({ kind, title, date, time, location, notes }: CalendarEventData) => ({
  kind,
  title,
  event_date: date,
  start_time: time,
  location,
  notes,
});

/** Ajoute un rendez-vous au calendrier du mariage courant (tous les membres). */
export async function addCalendarEvent(
  input: CalendarEventInput,
): Promise<CalendarActionResult> {
  const parsed = parseCalendarEvent(input);
  if (!parsed.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) return { ok: false, error: "unauthenticated" };

  let wedding: Awaited<ReturnType<typeof getCurrentWedding>>;
  try {
    wedding = await getCurrentWedding(supabase);
  } catch {
    return { ok: false, error: "generic" };
  }
  if (!wedding) return { ok: false, error: "forbidden" };

  const { error } = await supabase
    .from("calendar_events")
    .insert({ wedding_id: wedding.id, ...toRow(parsed.data) });
  if (error) {
    console.error("[calendar] addCalendarEvent:", error.code);
    return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  }

  revalidateCalendar();
  return { ok: true };
}

/** Modifie un rendez-vous ; la RLS limite l'accès aux membres du mariage. */
export async function updateCalendarEvent(
  eventId: string,
  input: CalendarEventInput,
): Promise<CalendarActionResult> {
  const id = z.uuid().safeParse(eventId);
  const parsed = parseCalendarEvent(input);
  if (!id.success || !parsed.ok) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("calendar_events")
    .update(toRow(parsed.data))
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("[calendar] updateCalendarEvent:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateCalendar();
  return { ok: true };
}

/** Retire un rendez-vous du calendrier. */
export async function deleteCalendarEvent(eventId: string): Promise<CalendarActionResult> {
  const id = z.uuid().safeParse(eventId);
  if (!id.success) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("[calendar] deleteCalendarEvent:", error.code);
    return { ok: false, error: "generic" };
  }
  if (data.length === 0) return { ok: false, error: "forbidden" };

  revalidateCalendar();
  return { ok: true };
}

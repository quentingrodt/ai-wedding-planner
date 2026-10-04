import type { BudgetItem } from "@/lib/budget/schema";
import type { Guest, GuestFamily } from "@/lib/guests/schema";
import { readStyleDna, type StyleDna } from "@/lib/inspiration/style-dna";
import { invitationDesignSchema, type InvitationDesign } from "@/lib/invitations/schema";
import {
  planAllocationSchema,
  weddingPlanSchema,
  type StoredWeddingPlan,
} from "@/lib/plan/schema";
import { toTimeKey, type ItineraryEvent } from "@/lib/itinerary/schema";
import type { Quote } from "@/lib/quotes/schema";
import type { SeatedGuest, SeatingTable } from "@/lib/seating/schema";
import type { Task } from "@/lib/tasks/schema";
import { ROLE_ORDER, type TeamMember } from "@/lib/team/schema";
import type { createClient } from "@/utils/supabase/client";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Identifiant de l'utilisateur connecté (JWT vérifié), ou null. */
export async function getCurrentUserId(
  supabase: ServerClient,
): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims.sub;
}

export type WeddingSummary = {
  id: string;
  title: string;
  wedding_date: string | null;
  total_budget: number | null;
  currency_code: string;
  guest_count: number | null;
};

/**
 * Premier mariage auquel l'utilisateur a accès (RLS : créateur ou membre).
 * Le multi-projets viendra plus tard : on prend le plus ancien.
 */
export async function getCurrentWedding(
  supabase: ServerClient,
): Promise<WeddingSummary | null> {
  const { data, error } = await supabase
    .from("weddings")
    .select("id, title, wedding_date, total_budget, currency_code, guest_count")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WeddingSummary>();

  if (error) {
    console.error("[weddings] getCurrentWedding:", error.code);
    throw new Error("Unable to load wedding");
  }
  if (!data) return null;
  // numeric(12,2) peut arriver sous forme de chaîne selon la configuration PostgREST.
  return {
    ...data,
    total_budget: data.total_budget === null ? null : Number(data.total_budget),
  };
}

/** Style DNA du mariage (carnet d'inspiration), lu de façon tolérante. */
export async function getWeddingStyleDna(
  supabase: ServerClient,
  weddingId: string,
): Promise<StyleDna> {
  const { data, error } = await supabase
    .from("weddings")
    .select("style_dna")
    .eq("id", weddingId)
    .single<{ style_dna: unknown }>();

  if (error) {
    console.error("[weddings] getWeddingStyleDna:", error.code);
    throw new Error("Unable to load style DNA");
  }
  return readStyleDna(data.style_dna);
}

/**
 * Dernier plan d'accompagnement (owner et partner uniquement, par la RLS).
 * Tolérant : une erreur de lecture ou un plan illisible donnent null.
 */
export async function getLatestWeddingPlan(
  supabase: ServerClient,
  weddingId: string,
): Promise<StoredWeddingPlan | null> {
  const { data, error } = await supabase
    .from("wedding_plans")
    .select("plan, allocation, created_at")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ plan: unknown; allocation: unknown; created_at: string }>();

  if (error) {
    console.error("[weddings] getLatestWeddingPlan:", error.code);
    return null;
  }
  if (!data) return null;
  const plan = weddingPlanSchema.safeParse(data.plan);
  const allocation = planAllocationSchema.safeParse(data.allocation);
  if (!plan.success || !allocation.success) return null;
  return { plan: plan.data, allocation: allocation.data, createdAt: data.created_at };
}

/**
 * Faire-part enregistré du mariage, ou null s'il n'existe pas encore.
 * Tolérant : une erreur de lecture ou un design illisible donnent null
 * (l'éditeur repart alors du design suggéré).
 */
export async function getInvitation(
  supabase: ServerClient,
  weddingId: string,
): Promise<{ design: InvitationDesign; unlockedAt: string | null } | null> {
  const { data, error } = await supabase
    .from("invitations")
    .select("design, unlocked_at")
    .eq("wedding_id", weddingId)
    .maybeSingle<{ design: unknown; unlocked_at: string | null }>();

  if (error) {
    console.error("[weddings] getInvitation:", error.code);
    return null;
  }
  if (!data) return null;
  const design = invitationDesignSchema.safeParse(data.design);
  return design.success ? { design: design.data, unlockedAt: data.unlocked_at } : null;
}

/** Prochaines tâches à faire, de la plus urgente à la plus lointaine. */
export async function getUpcomingTasks(
  supabase: ServerClient,
  weddingId: string,
  limit = 5,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, template_key, title, status, target_offset_days, due_date")
    .eq("wedding_id", weddingId)
    .eq("status", "todo")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("target_offset_days", { ascending: true })
    .limit(limit)
    .returns<Task[]>();

  if (error) {
    console.error("[weddings] getUpcomingTasks:", error.code);
    throw new Error("Unable to load tasks");
  }
  return data;
}

/** Lignes de budget du mariage, dans l'ordre de création. */
export async function getBudgetItems(
  supabase: ServerClient,
  weddingId: string,
): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from("budget_items")
    .select("id, category, label, estimated_amount, actual_amount")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true })
    .returns<BudgetItem[]>();

  if (error) {
    console.error("[weddings] getBudgetItems:", error.code);
    throw new Error("Unable to load budget");
  }
  return data;
}

export type WeddingRole = "owner" | "partner" | "witness";

/** Rôle de l'utilisateur connecté dans le mariage, ou null s'il n'en est pas membre. */
export async function getCurrentMemberRole(
  supabase: ServerClient,
  weddingId: string,
  userId: string,
): Promise<WeddingRole | null> {
  const { data, error } = await supabase
    .from("wedding_members")
    .select("role")
    .eq("wedding_id", weddingId)
    .eq("user_id", userId)
    .maybeSingle<{ role: WeddingRole }>();

  if (error) {
    console.error("[weddings] getCurrentMemberRole:", error.code);
    throw new Error("Unable to load membership");
  }
  return data?.role ?? null;
}

/** Invités du mariage, du plus récemment ajouté au plus ancien. */
export async function getGuests(
  supabase: ServerClient,
  weddingId: string,
): Promise<Guest[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, status, dietary_requirements, is_child, family_id, rsvp_token")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false })
    .returns<Guest[]>();

  if (error) {
    console.error("[weddings] getGuests:", error.code);
    throw new Error("Unable to load guests");
  }
  return data;
}

/** Familles d'invités, par ordre alphabétique. */
export async function getGuestFamilies(
  supabase: ServerClient,
  weddingId: string,
): Promise<GuestFamily[]> {
  const { data, error } = await supabase
    .from("guest_families")
    .select("id, name")
    .eq("wedding_id", weddingId)
    .order("name", { ascending: true })
    .returns<GuestFamily[]>();

  if (error) {
    console.error("[weddings] getGuestFamilies:", error.code);
    throw new Error("Unable to load guest families");
  }
  return data;
}

/** Devis du mariage, du plus récent au plus ancien. */
export async function getQuotes(
  supabase: ServerClient,
  weddingId: string,
): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, file_name, vendor_name, category, status, total_ttc, created_at")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false })
    .returns<Quote[]>();

  if (error) {
    console.error("[weddings] getQuotes:", error.code);
    throw new Error("Unable to load quotes");
  }
  return data;
}

/** Tables du plan de table, dans l'ordre de création. */
export async function getSeatingTables(
  supabase: ServerClient,
  weddingId: string,
): Promise<SeatingTable[]> {
  const { data, error } = await supabase
    .from("seating_tables")
    .select("id, name, capacity")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true })
    .returns<SeatingTable[]>();

  if (error) {
    console.error("[weddings] getSeatingTables:", error.code);
    throw new Error("Unable to load seating tables");
  }
  return data;
}

/** Invités confirmés, seuls concernés par le plan de table, par ordre alphabétique. */
export async function getConfirmedGuests(
  supabase: ServerClient,
  weddingId: string,
): Promise<SeatedGuest[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, is_child, dietary_requirements, seating_table_id")
    .eq("wedding_id", weddingId)
    .eq("status", "confirmed")
    .order("first_name", { ascending: true })
    .returns<SeatedGuest[]>();

  if (error) {
    console.error("[weddings] getConfirmedGuests:", error.code);
    throw new Error("Unable to load confirmed guests");
  }
  return data;
}

/** Conducteur du jour J, dans l'ordre chronologique (created_at en départage). */
export async function getItineraryEvents(
  supabase: ServerClient,
  weddingId: string,
): Promise<ItineraryEvent[]> {
  const { data, error } = await supabase
    .from("itinerary_events")
    .select("id, start_time, title, location, description, created_at")
    .eq("wedding_id", weddingId)
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<ItineraryEvent[]>();

  if (error) {
    console.error("[weddings] getItineraryEvents:", error.code);
    throw new Error("Unable to load itinerary");
  }
  return data.map((event) => ({ ...event, start_time: toTimeKey(event.start_time) }));
}

/** Membres du mariage avec leur profil (RLS : profils des co-membres lisibles). */
export async function getTeamMembers(
  supabase: ServerClient,
  weddingId: string,
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("wedding_members")
    .select("user_id, role, created_at, profiles(full_name, email)")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true })
    .returns<
      {
        user_id: string;
        role: WeddingRole;
        profiles: { full_name: string | null; email: string | null } | null;
      }[]
    >();

  if (error) {
    console.error("[weddings] getTeamMembers:", error.code);
    throw new Error("Unable to load team");
  }
  return data
    .map(({ user_id, role, profiles }) => ({
      user_id,
      role,
      full_name: profiles?.full_name ?? null,
      email: profiles?.email ?? null,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
}

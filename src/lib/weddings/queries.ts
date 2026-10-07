import type { BudgetItem } from "@/lib/budget/schema";
import type { CalendarEvent } from "@/lib/calendar/schema";
import { SEATED_EVENT, type Guest, type GuestFamily } from "@/lib/guests/schema";
import { readStyleDna, type StyleDna } from "@/lib/inspiration/style-dna";
import { invitationDesignSchema, type InvitationDesign } from "@/lib/invitations/schema";
import {
  planAllocationSchema,
  weddingPlanSchema,
  type StoredWeddingPlan,
} from "@/lib/plan/schema";
import { toTimeKey, type ItineraryEvent } from "@/lib/itinerary/schema";
import type { MoodboardItem } from "@/lib/moodboard/schema";
import type {
  Registry,
  RegistryFund,
  RegistryGift,
  RegistryPledge,
  RegistrySuggestion,
} from "@/lib/registry/schema";
import { LODGING_COLUMNS, type Lodging, type LodgingGuest } from "@/lib/lodging/schema";
import type { Quote } from "@/lib/quotes/schema";
import type { VendorCategory } from "@/lib/vendors/catalog";
import { VENDOR_COLUMNS, type Vendor } from "@/lib/vendors/schema";
import { VENUE_COLUMNS, type Venue } from "@/lib/venues/schema";
import type { SeatedGuest, SeatingTable } from "@/lib/seating/schema";
import { planningAnswersSchema, type PlanningAnswers } from "@/lib/planning/schema";
import type { PlanningTaskRow, Task } from "@/lib/tasks/schema";
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

/** Toutes les tâches du mariage, par échéance (rétroplanning). */
export async function getPlanningTasks(
  supabase: ServerClient,
  weddingId: string,
): Promise<PlanningTaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, template_key, title, status, target_offset_days, due_date, category, depends_on_key, rescheduled",
    )
    .eq("wedding_id", weddingId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("target_offset_days", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<PlanningTaskRow[]>();

  if (error) {
    console.error("[weddings] getPlanningTasks:", error.code);
    throw new Error("Unable to load tasks");
  }
  return data;
}

/**
 * Réponses du questionnaire de rétroplanning (null : pas encore rempli, ou
 * illisibles) et pays du mariage.
 */
export async function getPlanningSetup(
  supabase: ServerClient,
  weddingId: string,
): Promise<{ answers: PlanningAnswers | null; countryCode: string | null }> {
  const { data, error } = await supabase
    .from("weddings")
    .select("planning_answers, country_code")
    .eq("id", weddingId)
    .single<{ planning_answers: unknown; country_code: string | null }>();

  if (error) {
    console.error("[weddings] getPlanningSetup:", error.code);
    throw new Error("Unable to load planning answers");
  }
  const answers = planningAnswersSchema.safeParse(data.planning_answers);
  return {
    answers: answers.success ? answers.data : null,
    countryCode: data.country_code,
  };
}

/** Rendez-vous du calendrier, par date puis par heure (journée entière d'abord). */
export async function getCalendarEvents(
  supabase: ServerClient,
  weddingId: string,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, kind, title, event_date, start_time, location, notes")
    .eq("wedding_id", weddingId)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .returns<CalendarEvent[]>();

  if (error) {
    console.error("[weddings] getCalendarEvents:", error.code);
    throw new Error("Unable to load calendar");
  }
  // PostgreSQL renvoie « HH:MM:SS » : on garde « HH:MM ».
  return data.map((event) => ({
    ...event,
    start_time: event.start_time === null ? null : toTimeKey(event.start_time),
  }));
}

/** Lignes de budget du mariage, dans l'ordre de création. */
export async function getBudgetItems(
  supabase: ServerClient,
  weddingId: string,
): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from("budget_items")
    .select(
      "id, category, label, estimated_amount, actual_amount, suggested_amount, sourcing, section, line_key, notes, payer",
    )
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
    .select(
      "id, first_name, last_name, status, dietary_requirements, is_child, family_id, events, rsvp_token",
    )
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

/** Tables du plan de table : la table d'honneur d'abord, puis l'ordre de création. */
export async function getSeatingTables(
  supabase: ServerClient,
  weddingId: string,
): Promise<SeatingTable[]> {
  const { data, error } = await supabase
    .from("seating_tables")
    .select("id, name, capacity, is_head")
    .order("is_head", { ascending: false })
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: true })
    .returns<SeatingTable[]>();

  if (error) {
    console.error("[weddings] getSeatingTables:", error.code);
    throw new Error("Unable to load seating tables");
  }
  return data;
}

/**
 * Invités confirmés et conviés au dîner, seuls concernés par le plan de table,
 * par ordre alphabétique.
 */
export async function getConfirmedGuests(
  supabase: ServerClient,
  weddingId: string,
): Promise<SeatedGuest[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, is_child, dietary_requirements, seating_table_id")
    .eq("wedding_id", weddingId)
    .eq("status", "confirmed")
    .contains("events", [SEATED_EVENT])
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

/** Éléments de la planche de tendances, du plus récent au plus ancien. */
export async function getMoodboardItems(
  supabase: ServerClient,
  weddingId: string,
): Promise<MoodboardItem[]> {
  const { data, error } = await supabase
    .from("moodboard_items")
    .select("id, kind, file_path, pinterest_url, caption, category, created_by, created_at")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false })
    .returns<MoodboardItem[]>();

  if (error) {
    console.error("[weddings] getMoodboardItems:", error.code);
    throw new Error("Unable to load mood board");
  }
  return data;
}

/** La notice « qui paie quoi » du budget a-t-elle déjà été lue par cet utilisateur ? */
export async function hasSeenBudgetIntro(supabase: ServerClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("budget_intro_seen_at")
    .eq("id", userId)
    .maybeSingle<{ budget_intro_seen_at: string | null }>();
  if (error) {
    console.error("[weddings] hasSeenBudgetIntro:", error.code);
    // En cas de doute, on ne réimpose pas la notice.
    return true;
  }
  return data?.budget_intro_seen_at != null;
}

/**
 * Liste de mariage : réglages (null tant que le parcours d'ouverture n'a pas
 * été mené), cadeaux par rubrique, projets de l'urne, et ce que les invités
 * ont réservé, promis ou suggéré.
 */
export async function getRegistry(
  supabase: ServerClient,
  weddingId: string,
): Promise<{
  registry: Registry | null;
  gifts: RegistryGift[];
  funds: RegistryFund[];
  pledges: RegistryPledge[];
  suggestions: RegistrySuggestion[];
}> {
  const [registry, gifts, funds, pledges, suggestions] = await Promise.all([
    supabase
      .from("registries")
      .select("note, accepts_suggestions, payment_link, payment_details")
      .eq("wedding_id", weddingId)
      .maybeSingle<Registry>(),
    supabase
      .from("registry_gifts")
      .select("id, section, title, description, price, quantity, url, image_url, is_heirloom, position")
      .eq("wedding_id", weddingId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<RegistryGift[]>(),
    supabase
      .from("registry_funds")
      .select("id, kind, title, description, goal, position")
      .eq("wedding_id", weddingId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<RegistryFund[]>(),
    // Réservations et participations des invités, avec leur nom (cf. 000026).
    supabase
      .from("registry_pledges")
      .select("id, guest_id, gift_id, fund_id, quantity, amount, message, created_at, guests(first_name, last_name)")
      .eq("wedding_id", weddingId)
      .order("created_at", { ascending: true })
      .returns<RegistryPledge[]>(),
    supabase
      .from("registry_suggestions")
      .select("id, idea, created_at, guests(first_name, last_name)")
      .eq("wedding_id", weddingId)
      .order("created_at", { ascending: false })
      .returns<RegistrySuggestion[]>(),
  ]);

  const error = registry.error ?? gifts.error ?? funds.error ?? pledges.error ?? suggestions.error;
  if (error) {
    console.error("[weddings] getRegistry:", error.code);
    throw new Error("Unable to load the registry");
  }
  return {
    registry: registry.data,
    gifts: gifts.data ?? [],
    funds: funds.data ?? [],
    pledges: pledges.data ?? [],
    suggestions: suggestions.data ?? [],
  };
}

/** Lieux de réception envisagés (réservés aux mariés, cf. 000027). */
export async function getVenues(supabase: ServerClient, weddingId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_COLUMNS)
    .eq("wedding_id", weddingId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Venue[]>();

  if (error) {
    console.error("[weddings] getVenues:", error.code);
    throw new Error("Unable to load venues");
  }
  return data;
}

/** Invités et hébergements, pour la page Hébergement (cf. 000028). */
export async function getLodging(
  supabase: ServerClient,
  weddingId: string,
): Promise<{ guests: LodgingGuest[]; lodgings: Lodging[] }> {
  const [guests, lodgings] = await Promise.all([
    supabase
      .from("guests")
      .select("id, first_name, last_name, status, is_child, family_id, needs_lodging, lodging_id")
      .eq("wedding_id", weddingId)
      .order("first_name", { ascending: true })
      .returns<LodgingGuest[]>(),
    supabase
      .from("guest_lodgings")
      .select(LODGING_COLUMNS)
      .eq("wedding_id", weddingId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<Lodging[]>(),
  ]);

  const error = guests.error ?? lodgings.error;
  if (error) {
    console.error("[weddings] getLodging:", error.code);
    throw new Error("Unable to load lodging");
  }
  return { guests: guests.data ?? [], lodgings: lodgings.data ?? [] };
}

/** Prestataires du mariage, d'une catégorie ou de toutes (réservés aux mariés, cf. 000031). */
export async function getVendors(
  supabase: ServerClient,
  weddingId: string,
  category?: VendorCategory,
): Promise<Vendor[]> {
  let query = supabase.from("vendors").select(VENDOR_COLUMNS).eq("wedding_id", weddingId);
  if (category) query = query.eq("category", category);
  const { data, error } = await query
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<Vendor[]>();

  if (error) {
    console.error("[weddings] getVendors:", error.code);
    throw new Error("Unable to load vendors");
  }
  return data;
}

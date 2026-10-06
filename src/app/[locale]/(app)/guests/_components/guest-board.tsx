"use client";

import { SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  summarizeEvents,
  summarizeGuests,
  type Guest,
  type GuestEvent,
  type GuestFamily,
  type GuestStatus,
} from "@/lib/guests/schema";
import {
  assignGuestFamily,
  deleteFamily,
  deleteGuest,
  renameFamily,
  updateGuestEvents,
  updateGuestStatus,
} from "../actions";
import { AddGuestDialog } from "./add-guest-dialog";
import { CreateFamilyDialog } from "./create-family-dialog";
import { EventHeadcounts } from "./event-headcounts";
import { FamilyDetailDialog } from "./family-detail-dialog";
import { GuestKpis } from "./guest-kpis";
import { GuestRow } from "./guest-row";
import { HouseholdSection } from "./household-section";
import { RemindPanel } from "./remind-panel";

const FILTERS = ["all", "confirmed", "pending", "declined"] as const;
type GuestFilter = (typeof FILTERS)[number];

const FILTER_MATCHERS: Record<GuestFilter, (status: GuestStatus) => boolean> = {
  all: () => true,
  confirmed: (status) => status === "confirmed",
  pending: (status) => status === "invited" || status === "tentative",
  declined: (status) => status === "declined",
};

/** Section des invités sans famille. */
const OTHERS_ID = "others";

type OptimisticAction =
  | { type: "status"; id: string; status: GuestStatus }
  | { type: "events"; id: string; events: GuestEvent[] }
  | { type: "delete"; id: string }
  | { type: "family"; id: string; familyId: string | null }
  | { type: "familyDeleted"; familyId: string };

function applyAction(state: Guest[], action: OptimisticAction): Guest[] {
  switch (action.type) {
    case "delete":
      return state.filter((guest) => guest.id !== action.id);
    case "status":
      return state.map((guest) =>
        guest.id === action.id ? { ...guest, status: action.status } : guest,
      );
    case "events":
      return state.map((guest) =>
        guest.id === action.id ? { ...guest, events: action.events } : guest,
      );
    case "family":
      return state.map((guest) =>
        guest.id === action.id ? { ...guest, family_id: action.familyId } : guest,
      );
    case "familyDeleted":
      return state.map((guest) =>
        guest.family_id === action.familyId ? { ...guest, family_id: null } : guest,
      );
  }
}

type OptimisticFamilyAction =
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string };

function applyFamilyAction(state: GuestFamily[], action: OptimisticFamilyAction): GuestFamily[] {
  if (action.type === "delete") return state.filter((family) => family.id !== action.id);
  return state.map((family) =>
    family.id === action.id ? { ...family, name: action.name } : family,
  );
}

// Recherche insensible à la casse et aux accents (« Zoé » ↔ « zoe »).
function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function fullName(guest: Guest): string {
  return guest.last_name ? `${guest.first_name} ${guest.last_name}` : guest.first_name;
}

type Household = {
  id: string;
  title: string;
  family: GuestFamily | null;
  /** Tous les membres, pour le résumé du foyer. */
  members: Guest[];
  /** Membres correspondant aux filtres et à la recherche. */
  visible: Guest[];
};

type GuestBoardProps = {
  guests: Guest[];
  families: GuestFamily[];
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
  /** Signature et date des messages de relance. */
  coupleNames: string;
  weddingDateLabel: string | null;
};

/**
 * Indicateurs, filtres et liste des invités rangée par foyer,
 * avec mises à jour instantanées.
 */
export function GuestBoard({
  guests,
  families,
  canEdit,
  coupleNames,
  weddingDateLabel,
}: GuestBoardProps) {
  const t = useTranslations("Guests");
  const locale = useLocale();
  const [, startTransition] = useTransition();
  const [optimisticGuests, apply] = useOptimistic(guests, applyAction);
  const [optimisticFamilies, applyFamily] = useOptimistic(families, applyFamilyAction);
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [eventFilter, setEventFilter] = useState<GuestEvent | null>(null);
  const [query, setQuery] = useState("");
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const familyById = new Map(optimisticFamilies.map((family) => [family.id, family]));
  const familyName = (guest: Guest) =>
    guest.family_id ? familyById.get(guest.family_id)?.name : undefined;

  // Adultes d'abord, puis ordre alphabétique (nom, puis prénom).
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const byName = (a: Guest, b: Guest) =>
    Number(a.is_child) - Number(b.is_child) ||
    collator.compare(a.last_name ?? a.first_name, b.last_name ?? b.first_name) ||
    collator.compare(a.first_name, b.first_name);

  const summary = summarizeGuests(optimisticGuests);
  const needle = normalize(query.trim());
  const matchesSearch = (guest: Guest) =>
    needle === "" ||
    normalize(fullName(guest)).includes(needle) ||
    normalize(familyName(guest) ?? "").includes(needle);
  const matches = (guest: Guest) =>
    FILTER_MATCHERS[filter](guest.status) &&
    (eventFilter === null || guest.events.includes(eventFilter)) &&
    matchesSearch(guest);

  const membersByFamily = new Map<string, Guest[]>();
  const unassigned: Guest[] = [];
  for (const guest of optimisticGuests) {
    if (!guest.family_id) {
      unassigned.push(guest);
      continue;
    }
    const members = membersByFamily.get(guest.family_id) ?? [];
    members.push(guest);
    membersByFamily.set(guest.family_id, members);
  }
  for (const members of membersByFamily.values()) members.sort(byName);
  unassigned.sort(byName);

  const households: Household[] = [
    ...optimisticFamilies.map((family) => {
      const members = membersByFamily.get(family.id) ?? [];
      return { id: family.id, title: family.name, family, members, visible: members.filter(matches) };
    }),
    {
      id: OTHERS_ID,
      title: t("list.others"),
      family: null,
      members: unassigned,
      visible: unassigned.filter(matches),
    },
  ];
  // Un foyer s'affiche dès qu'un de ses membres correspond aux filtres ;
  // sans filtre, les familles encore vides restent visibles.
  const shownHouseholds = households.filter(
    ({ family, members, visible }) =>
      visible.length > 0 ||
      (family !== null &&
        members.length === 0 &&
        filter === "all" &&
        eventFilter === null &&
        (needle === "" || normalize(family.name).includes(needle))),
  );
  // Sans aucune famille, la liste se lit d'un bloc, sans en-tête de section.
  const flat = optimisticFamilies.length === 0;

  // Une recherche déplie tout : un résultat ne doit jamais être caché.
  const isExpanded = (id: string) => needle !== "" || !collapsed.has(id);
  const allCollapsed = shownHouseholds.every(({ id }) => collapsed.has(id));
  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(shownHouseholds.map(({ id }) => id)));
  }

  // Réponses attendues, toutes familles confondues, pour l'encart de relance.
  const pending = optimisticGuests
    .filter((guest) => FILTER_MATCHERS.pending(guest.status))
    .sort(byName);

  const openFamily = openFamilyId ? (familyById.get(openFamilyId) ?? null) : null;
  const remind = { coupleNames, weddingDateLabel };

  function changeStatus(guest: Guest, status: GuestStatus) {
    if (status === guest.status) return;
    startTransition(async () => {
      apply({ type: "status", id: guest.id, status });
      const result = await updateGuestStatus(guest.id, status);
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  function changeEvents(guest: Guest, events: GuestEvent[]) {
    startTransition(async () => {
      apply({ type: "events", id: guest.id, events });
      const result = await updateGuestEvents(guest.id, events);
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  function remove(guest: Guest) {
    startTransition(async () => {
      apply({ type: "delete", id: guest.id });
      const result = await deleteGuest(guest.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(t("delete.success", { name: fullName(guest) }));
    });
  }

  function assignFamily(guest: Guest, familyId: string | null) {
    if (familyId === guest.family_id) return;
    startTransition(async () => {
      apply({ type: "family", id: guest.id, familyId });
      const result = await assignGuestFamily(guest.id, familyId);
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  function rename(family: GuestFamily, name: string) {
    startTransition(async () => {
      applyFamily({ type: "rename", id: family.id, name });
      const result = await renameFamily(family.id, name);
      if (!result.ok) {
        toast.error(t(`errors.${result.error === "invalid" ? "generic" : result.error}`));
      }
    });
  }

  function removeFamily(family: GuestFamily) {
    setOpenFamilyId(null);
    startTransition(async () => {
      applyFamily({ type: "delete", id: family.id });
      apply({ type: "familyDeleted", familyId: family.id });
      const result = await deleteFamily(family.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(t("families.delete.success", { name: family.name }));
    });
  }

  const rows = (list: Guest[]) =>
    list.map((guest) => (
      <GuestRow
        key={guest.id}
        guest={guest}
        fullName={fullName}
        canEdit={canEdit}
        remind={remind}
        onStatusChange={changeStatus}
        onEventsChange={changeEvents}
        onDelete={remove}
      />
    ));

  const content =
    optimisticGuests.length === 0 && flat ? (
      <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">{t("empty")}</p>
    ) : shownHouseholds.length === 0 ? (
      <p className="px-2 py-10 text-center text-stone">{t("emptyFilter")}</p>
    ) : flat ? (
      <ul className="flex flex-col divide-y divide-border rounded-3xl bg-card px-5 ring-1 ring-border">
        {rows(shownHouseholds[0]?.visible ?? [])}
      </ul>
    ) : (
      <div className="flex flex-col gap-3">
        {needle === "" && shownHouseholds.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="self-end rounded-full px-3 py-1 text-sm text-stone underline-offset-4 hover:text-charcoal hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {allCollapsed ? t("list.expandAll") : t("list.collapseAll")}
          </button>
        )}
        {shownHouseholds.map(({ id, title, family, members, visible }) => (
          <HouseholdSection
            key={id}
            id={id}
            title={title}
            members={members}
            expanded={isExpanded(id)}
            onToggle={() => toggle(id)}
            onManage={family ? () => setOpenFamilyId(family.id) : undefined}
          >
            {rows(visible)}
          </HouseholdSection>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <GuestKpis summary={summary} />

      {optimisticGuests.length > 0 && (
        <EventHeadcounts
          counts={summarizeEvents(optimisticGuests)}
          selected={eventFilter}
          onSelect={setEventFilter}
        />
      )}

      {pending.length > 0 && filter !== "pending" && (
        <RemindPanel
          pending={pending}
          fullName={fullName}
          remind={remind}
          onShowAll={() => setFilter("pending")}
        />
      )}

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as GuestFilter)}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line" className="max-w-full overflow-x-auto">
            {FILTERS.map((value) => (
              <TabsTrigger key={value} value={value} className="px-3">
                {t(`filters.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("search.label")}
                placeholder={t("search.placeholder")}
                className="h-11 rounded-full bg-card pl-9 text-base sm:w-56"
              />
            </div>
            {canEdit && <CreateFamilyDialog onCreated={setOpenFamilyId} />}
            {canEdit && <AddGuestDialog families={optimisticFamilies} />}
          </div>
        </div>

        {FILTERS.map((value) => (
          <TabsContent key={value} value={value}>
            {content}
          </TabsContent>
        ))}
      </Tabs>

      <FamilyDetailDialog
        family={openFamily}
        members={openFamily ? (membersByFamily.get(openFamily.id) ?? []) : []}
        unassigned={unassigned}
        families={optimisticFamilies}
        canEdit={canEdit}
        fullName={fullName}
        remind={remind}
        onClose={() => setOpenFamilyId(null)}
        onStatusChange={changeStatus}
        onEventsChange={changeEvents}
        onAssign={assignFamily}
        onRename={rename}
        onDelete={removeFamily}
      />
    </div>
  );
}

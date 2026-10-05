"use client";

import { ListIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  summarizeGuests,
  type Guest,
  type GuestFamily,
  type GuestStatus,
} from "@/lib/guests/schema";
import { cn } from "@/lib/utils";
import {
  assignGuestFamily,
  deleteFamily,
  deleteGuest,
  renameFamily,
  updateGuestStatus,
} from "../actions";
import { AddGuestDialog } from "./add-guest-dialog";
import { CreateFamilyDialog } from "./create-family-dialog";
import { DeleteGuestButton } from "./delete-guest-button";
import { FamilyDetailDialog } from "./family-detail-dialog";
import { FamilyList, type FamilyGroup } from "./family-list";
import { GuestKpis } from "./guest-kpis";
import { GuestStatusBadge, GuestStatusSelect } from "./guest-status";
import { RemindGuestDialog } from "./remind-guest-dialog";

const FILTERS = ["all", "confirmed", "pending", "declined"] as const;
type GuestFilter = (typeof FILTERS)[number];

const FILTER_MATCHERS: Record<GuestFilter, (status: GuestStatus) => boolean> = {
  all: () => true,
  confirmed: (status) => status === "confirmed",
  pending: (status) => status === "invited" || status === "tentative",
  declined: (status) => status === "declined",
};

const VIEWS = ["list", "families"] as const;
type GuestView = (typeof VIEWS)[number];
const VIEW_ICONS = { list: ListIcon, families: UsersIcon } as const;

type OptimisticAction =
  | { type: "status"; id: string; status: GuestStatus }
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

type GuestBoardProps = {
  guests: Guest[];
  families: GuestFamily[];
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
  /** Signature et date des messages de relance. */
  coupleNames: string;
  weddingDateLabel: string | null;
};

/** Indicateurs, filtres et liste des invités, avec mises à jour instantanées. */
export function GuestBoard({
  guests,
  families,
  canEdit,
  coupleNames,
  weddingDateLabel,
}: GuestBoardProps) {
  const t = useTranslations("Guests");
  const [, startTransition] = useTransition();
  const [optimisticGuests, apply] = useOptimistic(guests, applyAction);
  const [optimisticFamilies, applyFamily] = useOptimistic(families, applyFamilyAction);
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [view, setView] = useState<GuestView>("list");
  const [query, setQuery] = useState("");
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);

  const familyById = new Map(optimisticFamilies.map((family) => [family.id, family]));
  const familyName = (guest: Guest) =>
    guest.family_id ? familyById.get(guest.family_id)?.name : undefined;

  const summary = summarizeGuests(optimisticGuests);
  const needle = normalize(query.trim());
  const matchesSearch = (guest: Guest) =>
    needle === "" ||
    normalize(fullName(guest)).includes(needle) ||
    normalize(familyName(guest) ?? "").includes(needle);
  const visible = optimisticGuests.filter(
    (guest) => FILTER_MATCHERS[filter](guest.status) && matchesSearch(guest),
  );

  // Une famille s'affiche dès qu'un de ses membres correspond aux filtres ;
  // sans filtre, les familles encore vides restent visibles.
  const membersByFamily = new Map<string, Guest[]>();
  for (const guest of optimisticGuests) {
    if (!guest.family_id) continue;
    const members = membersByFamily.get(guest.family_id) ?? [];
    members.push(guest);
    membersByFamily.set(guest.family_id, members);
  }
  const visibleFamilyIds = new Set(visible.map((guest) => guest.family_id));
  const familyGroups: FamilyGroup[] = optimisticFamilies
    .map((family) => ({ family, members: membersByFamily.get(family.id) ?? [] }))
    .filter(
      ({ family, members }) =>
        visibleFamilyIds.has(family.id) ||
        (members.length === 0 &&
          filter === "all" &&
          (needle === "" || normalize(family.name).includes(needle))),
    );
  const unassignedVisible = visible.filter((guest) => !guest.family_id);
  const unassigned = optimisticGuests.filter((guest) => !guest.family_id);

  const openFamily = openFamilyId ? (familyById.get(openFamilyId) ?? null) : null;

  function changeStatus(guest: Guest, status: GuestStatus) {
    if (status === guest.status) return;
    startTransition(async () => {
      apply({ type: "status", id: guest.id, status });
      const result = await updateGuestStatus(guest.id, status);
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

  const statusCell = (guest: Guest) =>
    canEdit ? (
      <GuestStatusSelect
        status={guest.status}
        guestName={fullName(guest)}
        onChange={(status) => changeStatus(guest, status)}
      />
    ) : (
      <GuestStatusBadge status={guest.status} />
    );

  // Relance : ouverte à tous les membres (témoins compris), pour les réponses en attente.
  const guestActions = (guest: Guest) => (
    <span className="inline-flex items-center gap-1">
      {(guest.status === "invited" || guest.status === "tentative") && (
        <RemindGuestDialog
          guestName={fullName(guest)}
          firstName={guest.first_name}
          coupleNames={coupleNames}
          weddingDateLabel={weddingDateLabel}
          rsvpToken={guest.rsvp_token}
        />
      )}
      {canEdit && (
        <DeleteGuestButton guestName={fullName(guest)} onConfirm={() => remove(guest)} />
      )}
    </span>
  );

  const childBadge = (
    <span className="rounded-full bg-sand/50 px-2.5 py-0.5 text-xs text-charcoal">
      {t("childBadge")}
    </span>
  );

  const guestList =
    optimisticGuests.length === 0 ? (
      <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
        {t("empty")}
      </p>
    ) : visible.length === 0 ? (
      <p className="px-2 py-10 text-center text-stone">{t("emptyFilter")}</p>
    ) : (
      <>
        {/* Bureau : tableau épuré */}
        <div className="hidden rounded-3xl bg-card px-4 py-2 ring-1 ring-border md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs tracking-[0.15em] text-stone uppercase">
                  {t("table.name")}
                </TableHead>
                <TableHead className="text-xs tracking-[0.15em] text-stone uppercase">
                  {t("table.status")}
                </TableHead>
                <TableHead className="text-xs tracking-[0.15em] text-stone uppercase">
                  {t("table.dietary")}
                </TableHead>
                <TableHead className="w-20">
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((guest) => (
                <TableRow key={guest.id} className="hover:bg-linen/50">
                  <TableCell className="py-3">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base">{fullName(guest)}</span>
                      {guest.is_child && childBadge}
                    </span>
                    {familyName(guest) && (
                      <span className="block truncate text-sm text-stone">
                        {familyName(guest)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">{statusCell(guest)}</TableCell>
                  <TableCell className="max-w-56 truncate py-3 text-stone">
                    {guest.dietary_requirements ?? t("table.noDietary")}
                  </TableCell>
                  <TableCell className="py-3 text-right">{guestActions(guest)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile : cartes empilées */}
        <ul className="flex flex-col gap-3 md:hidden">
          {visible.map((guest) => (
            <li
              key={guest.id}
              className="flex flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base wrap-break-word">{fullName(guest)}</span>
                    {guest.is_child && childBadge}
                  </span>
                  {familyName(guest) && (
                    <span className="text-sm wrap-break-word text-stone">{familyName(guest)}</span>
                  )}
                  {guest.dietary_requirements && (
                    <span className="text-sm wrap-break-word text-stone">
                      {guest.dietary_requirements}
                    </span>
                  )}
                </div>
                {guestActions(guest)}
              </div>
              <div>{statusCell(guest)}</div>
            </li>
          ))}
        </ul>
      </>
    );

  const familyContent =
    optimisticFamilies.length === 0 ? (
      <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
        {canEdit ? t("families.empty") : t("families.emptyReadOnly")}
      </p>
    ) : familyGroups.length === 0 && unassignedVisible.length === 0 ? (
      <p className="px-2 py-10 text-center text-stone">{t("emptyFilter")}</p>
    ) : (
      <FamilyList
        groups={familyGroups}
        unassigned={unassignedVisible}
        fullName={fullName}
        onOpen={setOpenFamilyId}
      />
    );

  const content = view === "list" ? guestList : familyContent;

  return (
    <div className="flex flex-col gap-8">
      <GuestKpis summary={summary} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label={t("views.label")}
          className="inline-flex w-fit rounded-full bg-linen p-1"
        >
          {VIEWS.map((value) => {
            const Icon = VIEW_ICONS[value];
            return (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm text-stone transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  view === value && "bg-card text-charcoal shadow-sm",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t(`views.${value}`)}
              </button>
            );
          })}
        </div>
        {canEdit && view === "families" && <CreateFamilyDialog onCreated={setOpenFamilyId} />}
      </div>

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as GuestFilter)}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        onClose={() => setOpenFamilyId(null)}
        onStatusChange={changeStatus}
        onAssign={assignFamily}
        onRename={rename}
        onDelete={removeFamily}
      />
    </div>
  );
}

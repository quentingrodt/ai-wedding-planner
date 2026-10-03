"use client";

import { SearchIcon } from "lucide-react";
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
import { summarizeGuests, type Guest, type GuestStatus } from "@/lib/guests/schema";
import { deleteGuest, updateGuestStatus } from "../actions";
import { AddGuestDialog } from "./add-guest-dialog";
import { DeleteGuestButton } from "./delete-guest-button";
import { GuestKpis } from "./guest-kpis";
import { GuestStatusBadge, GuestStatusSelect } from "./guest-status";

const FILTERS = ["all", "confirmed", "pending", "declined"] as const;
type GuestFilter = (typeof FILTERS)[number];

const FILTER_MATCHERS: Record<GuestFilter, (status: GuestStatus) => boolean> = {
  all: () => true,
  confirmed: (status) => status === "confirmed",
  pending: (status) => status === "invited" || status === "tentative",
  declined: (status) => status === "declined",
};

type OptimisticAction =
  | { type: "status"; id: string; status: GuestStatus }
  | { type: "delete"; id: string };

function applyAction(state: Guest[], action: OptimisticAction): Guest[] {
  if (action.type === "delete") return state.filter((guest) => guest.id !== action.id);
  return state.map((guest) =>
    guest.id === action.id ? { ...guest, status: action.status } : guest,
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
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
};

/** Indicateurs, filtres et liste des invités, avec mises à jour instantanées. */
export function GuestBoard({ guests, canEdit }: GuestBoardProps) {
  const t = useTranslations("Guests");
  const [, startTransition] = useTransition();
  const [optimisticGuests, apply] = useOptimistic(guests, applyAction);
  const [filter, setFilter] = useState<GuestFilter>("all");
  const [query, setQuery] = useState("");

  const summary = summarizeGuests(optimisticGuests);
  const needle = normalize(query.trim());
  const visible = optimisticGuests.filter(
    (guest) =>
      FILTER_MATCHERS[filter](guest.status) &&
      (needle === "" || normalize(fullName(guest)).includes(needle)),
  );

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

  const deleteAction = (guest: Guest) =>
    canEdit ? (
      <DeleteGuestButton guestName={fullName(guest)} onConfirm={() => remove(guest)} />
    ) : null;

  const childBadge = (
    <span className="rounded-full bg-sand/50 px-2.5 py-0.5 text-xs text-charcoal">
      {t("childBadge")}
    </span>
  );

  const list =
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
                {canEdit && (
                  <TableHead className="w-10">
                    <span className="sr-only">{t("table.actions")}</span>
                  </TableHead>
                )}
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
                  </TableCell>
                  <TableCell className="py-3">{statusCell(guest)}</TableCell>
                  <TableCell className="max-w-56 truncate py-3 text-stone">
                    {guest.dietary_requirements ?? t("table.noDietary")}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="py-3 text-right">{deleteAction(guest)}</TableCell>
                  )}
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
                  {guest.dietary_requirements && (
                    <span className="text-sm wrap-break-word text-stone">
                      {guest.dietary_requirements}
                    </span>
                  )}
                </div>
                {deleteAction(guest)}
              </div>
              <div>{statusCell(guest)}</div>
            </li>
          ))}
        </ul>
      </>
    );

  return (
    <div className="flex flex-col gap-8">
      <GuestKpis summary={summary} />

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
            {canEdit && <AddGuestDialog />}
          </div>
        </div>

        {FILTERS.map((value) => (
          <TabsContent key={value} value={value}>
            {list}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

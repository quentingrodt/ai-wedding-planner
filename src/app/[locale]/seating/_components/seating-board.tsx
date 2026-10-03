"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeatedGuest, SeatingTable } from "@/lib/seating/schema";
import { cn } from "@/lib/utils";
import { assignGuestToTable, deleteTable } from "../actions";
import { CreateTableDialog } from "./create-table-dialog";
import { DeleteTableButton } from "./delete-table-button";

type SeatingState = { tables: SeatingTable[]; guests: SeatedGuest[] };

type OptimisticAction =
  | { type: "assign"; guestId: string; tableId: string | null }
  | { type: "deleteTable"; tableId: string };

// Une seule source de vérité : les deux listes sont dérivées de seating_table_id,
// un invité ne peut donc jamais apparaître à deux endroits.
function applyAction(state: SeatingState, action: OptimisticAction): SeatingState {
  if (action.type === "assign") {
    return {
      ...state,
      guests: state.guests.map((guest) =>
        guest.id === action.guestId ? { ...guest, seating_table_id: action.tableId } : guest,
      ),
    };
  }
  // Miroir du ON DELETE SET NULL : les invités de la table repassent « à placer ».
  return {
    tables: state.tables.filter((table) => table.id !== action.tableId),
    guests: state.guests.map((guest) =>
      guest.seating_table_id === action.tableId ? { ...guest, seating_table_id: null } : guest,
    ),
  };
}

function fullName(guest: SeatedGuest): string {
  return guest.last_name ? `${guest.first_name} ${guest.last_name}` : guest.first_name;
}

type SeatingBoardProps = {
  tables: SeatingTable[];
  guests: SeatedGuest[];
  /** Owner ou partner : la RLS refuse de toute façon l'écriture aux témoins. */
  canEdit: boolean;
};

/** Invités à placer et tables, avec déplacements instantanés. */
export function SeatingBoard({ tables, guests, canEdit }: SeatingBoardProps) {
  const t = useTranslations("Seating");
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic<SeatingState, OptimisticAction>(
    { tables, guests },
    applyAction,
  );

  const unseated = state.guests.filter((guest) => guest.seating_table_id === null);
  const guestsByTable = new Map<string, SeatedGuest[]>();
  for (const guest of state.guests) {
    if (guest.seating_table_id === null) continue;
    const seated = guestsByTable.get(guest.seating_table_id) ?? [];
    seated.push(guest);
    guestsByTable.set(guest.seating_table_id, seated);
  }
  const seatedCount = (tableId: string) => guestsByTable.get(tableId)?.length ?? 0;

  function assign(guest: SeatedGuest, tableId: string | null) {
    startTransition(async () => {
      apply({ type: "assign", guestId: guest.id, tableId });
      const result = await assignGuestToTable(guest.id, tableId);
      if (!result.ok) toast.error(t(`errors.${result.error}`, { name: fullName(guest) }));
    });
  }

  function removeTable(table: SeatingTable) {
    startTransition(async () => {
      apply({ type: "deleteTable", tableId: table.id });
      const result = await deleteTable(table.id);
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`, { name: table.name }));
        return;
      }
      toast(t("delete.success", { name: table.name }));
    });
  }

  const childBadge = (
    <span className="rounded-full bg-sand/50 px-2.5 py-0.5 text-xs text-charcoal">
      {t("childBadge")}
    </span>
  );

  return (
    <div className="flex flex-col gap-12">
      {/* Section 1 : invités à placer */}
      <section aria-labelledby="unseated-title" className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="unseated-title" className="font-serif text-2xl">
            {t("unseated.title")}
          </h2>
          <span className="text-sm text-stone">
            {t("unseated.count", { count: unseated.length })}
          </span>
        </div>

        {state.guests.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
            {t("unseated.noConfirmed")}
          </p>
        ) : unseated.length === 0 ? (
          <p className="rounded-3xl bg-sage-soft px-6 py-8 text-center text-sage-deep">
            {t("unseated.allSeated")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {unseated.map((guest) => (
              <li
                key={guest.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card px-5 py-4 ring-1 ring-border"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base">{fullName(guest)}</span>
                  {guest.is_child && childBadge}
                </span>
                {canEdit && (
                  <Select
                    value=""
                    disabled={state.tables.length === 0}
                    onValueChange={(tableId) => assign(guest, tableId)}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("unseated.assignLabel", { name: fullName(guest) })}
                      className="rounded-full border-transparent bg-sage-soft px-3 text-sage-deep"
                    >
                      <SelectValue
                        placeholder={
                          state.tables.length === 0
                            ? t("unseated.noTables")
                            : t("unseated.assign")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {state.tables.map((table) => {
                        const full = seatedCount(table.id) >= table.capacity;
                        return (
                          <SelectItem key={table.id} value={table.id} disabled={full}>
                            {table.name}
                            <span className="text-stone">
                              {full
                                ? t("unseated.full")
                                : t("unseated.seatsLeft", {
                                    count: table.capacity - seatedCount(table.id),
                                  })}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Section 2 : les tables */}
      <section aria-labelledby="tables-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="tables-title" className="font-serif text-2xl">
            {t("tables.title")}
          </h2>
          {canEdit && <CreateTableDialog />}
        </div>

        {state.tables.length === 0 ? (
          <p className="rounded-3xl bg-linen px-6 py-10 text-center text-stone">
            {t("tables.empty")}
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {state.tables.map((table) => {
              const seated = guestsByTable.get(table.id) ?? [];
              const full = seated.length >= table.capacity;
              const ratio = Math.min(seated.length / table.capacity, 1);
              return (
                <li
                  key={table.id}
                  className="flex flex-col gap-4 rounded-3xl border border-sage bg-linen p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 font-serif text-xl wrap-break-word">{table.name}</h3>
                    {canEdit && (
                      <DeleteTableButton
                        tableName={table.name}
                        onConfirm={() => removeTable(table)}
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className={full ? "text-terracotta" : "text-sage-deep"}>
                        {t("tables.seats", { seated: seated.length, capacity: table.capacity })}
                      </span>
                      {full && <span className="text-terracotta">{t("tables.full")}</span>}
                    </div>
                    <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-sand/60">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width,background-color] duration-500",
                          full ? "bg-terracotta" : "bg-sage",
                        )}
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                  </div>

                  {seated.length === 0 ? (
                    <p className="text-sm text-stone">{t("tables.noGuests")}</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-sand">
                      {seated.map((guest) => (
                        <li
                          key={guest.id}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{fullName(guest)}</span>
                            {guest.is_child && childBadge}
                          </span>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("tables.unassign", { name: fullName(guest) })}
                              onClick={() => assign(guest, null)}
                              className="text-stone hover:text-terracotta"
                            >
                              <XIcon aria-hidden />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

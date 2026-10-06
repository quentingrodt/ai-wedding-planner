"use client";

import {
  CalendarDaysIcon,
  EllipsisIcon,
  MessageCircleIcon,
  Trash2Icon,
  UserMinusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { summarizeGuestEvents, type Guest, type GuestEvent, type GuestStatus } from "@/lib/guests/schema";
import { DeleteGuestDialog } from "./delete-guest-dialog";
import { GuestEventsDialog, GuestEventsLabel } from "./guest-events";
import { GuestStatusBadge, GuestStatusSelect } from "./guest-status";
import { RemindGuestDialog } from "./remind-guest-dialog";

/** Signature et date des messages de relance. */
export type RemindContext = {
  coupleNames: string;
  weddingDateLabel: string | null;
};

type GuestRowProps = {
  guest: Guest;
  fullName: (guest: Guest) => string;
  /** Owner ou partner ; la relance reste ouverte à tous les membres. */
  canEdit: boolean;
  remind: RemindContext;
  onStatusChange: (guest: Guest, status: GuestStatus) => void;
  onEventsChange: (guest: Guest, events: GuestEvent[]) => void;
  /** Retrait de la liste (vue principale). */
  onDelete?: (guest: Guest) => void;
  /** Retrait de la famille (fiche famille). */
  onDetach?: (guest: Guest) => void;
};

type RowDialog = "events" | "remind" | "delete";

/**
 * Un invité sur une ligne : le nom, puis une ligne discrète réservée aux
 * exceptions (régime, étapes partielles). Les actions sont rangées dans un menu.
 */
export function GuestRow({
  guest,
  fullName,
  canEdit,
  remind,
  onStatusChange,
  onEventsChange,
  onDelete,
  onDetach,
}: GuestRowProps) {
  const t = useTranslations("Guests");
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  // Remonte la modale ouverte : son brouillon repart des valeurs actuelles.
  const [dialogKey, setDialogKey] = useState(0);

  const name = fullName(guest);
  const pending = guest.status === "invited" || guest.status === "tentative";
  const events = summarizeGuestEvents(guest.events);
  const eventsException = events.kind === "partial" || events.brunch;
  const hasMenu = canEdit || pending;

  function openDialog(next: RowDialog) {
    setDialogKey((key) => key + 1);
    setDialog(next);
  }
  const dialogProps = (kind: RowDialog) => ({
    open: dialog === kind,
    onOpenChange: (open: boolean) => {
      if (!open) setDialog(null);
    },
  });

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-base wrap-break-word">{name}</span>
          {guest.is_child && (
            <span className="rounded-full bg-sand/50 px-2 py-px text-xs text-charcoal">
              {t("childBadge")}
            </span>
          )}
        </span>
        {(eventsException || guest.dietary_requirements) && (
          <span className="flex flex-wrap gap-x-3 text-sm text-stone">
            {eventsException && <GuestEventsLabel events={guest.events} />}
            {guest.dietary_requirements && (
              <span className="wrap-break-word">{guest.dietary_requirements}</span>
            )}
          </span>
        )}
      </div>

      <div className="shrink-0">
        {canEdit ? (
          <GuestStatusSelect
            status={guest.status}
            guestName={name}
            variant="quiet"
            onChange={(status) => onStatusChange(guest, status)}
          />
        ) : (
          <GuestStatusBadge status={guest.status} variant="quiet" />
        )}
      </div>

      {hasMenu ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("row.menu", { name })}
              className="shrink-0 rounded-full text-stone"
            >
              <EllipsisIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
            {canEdit && (
              <DropdownMenuItem className="h-9 rounded-xl px-2.5" onSelect={() => openDialog("events")}>
                <CalendarDaysIcon aria-hidden />
                {t("row.events")}
              </DropdownMenuItem>
            )}
            {pending && (
              <DropdownMenuItem className="h-9 rounded-xl px-2.5" onSelect={() => openDialog("remind")}>
                <MessageCircleIcon aria-hidden />
                {t("row.remind")}
              </DropdownMenuItem>
            )}
            {canEdit && (onDetach || onDelete) && <DropdownMenuSeparator />}
            {canEdit && onDetach && (
              <DropdownMenuItem className="h-9 rounded-xl px-2.5" onSelect={() => onDetach(guest)}>
                <UserMinusIcon aria-hidden />
                {t("row.detach")}
              </DropdownMenuItem>
            )}
            {canEdit && onDelete && (
              <DropdownMenuItem
                variant="destructive"
                className="h-9 rounded-xl px-2.5"
                onSelect={() => openDialog("delete")}
              >
                <Trash2Icon aria-hidden />
                {t("row.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // Garde les statuts alignés d'une ligne à l'autre.
        <span aria-hidden className="size-8 shrink-0" />
      )}

      {canEdit && (
        <GuestEventsDialog
          key={`events-${dialogKey}`}
          {...dialogProps("events")}
          guestName={name}
          events={guest.events}
          onSave={(next) => onEventsChange(guest, next)}
        />
      )}
      {pending && (
        <RemindGuestDialog
          key={`remind-${dialogKey}`}
          {...dialogProps("remind")}
          guestName={name}
          firstName={guest.first_name}
          coupleNames={remind.coupleNames}
          weddingDateLabel={remind.weddingDateLabel}
          rsvpToken={guest.rsvp_token}
        />
      )}
      {canEdit && onDelete && (
        <DeleteGuestDialog
          key={`delete-${dialogKey}`}
          {...dialogProps("delete")}
          guestName={name}
          onConfirm={() => onDelete(guest)}
        />
      )}
    </li>
  );
}

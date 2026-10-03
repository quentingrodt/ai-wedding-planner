"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUEST_STATUSES, isGuestStatus, type GuestStatus } from "@/lib/guests/schema";
import { cn } from "@/lib/utils";

// Le texte reste anthracite (contraste AA) : la couleur passe par le fond et la pastille.
const STATUS_SURFACE: Record<GuestStatus, string> = {
  invited: "bg-linen",
  confirmed: "bg-sage-soft",
  tentative: "bg-sand/60",
  declined: "bg-terracotta-soft/60",
};

const STATUS_DOT: Record<GuestStatus, string> = {
  invited: "bg-stone/50",
  confirmed: "bg-sage",
  tentative: "bg-sand ring-1 ring-stone/30",
  declined: "bg-terracotta",
};

function StatusDot({ status }: { status: GuestStatus }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />
  );
}

/** Pastille de statut en lecture seule (témoins). */
export function GuestStatusBadge({ status }: { status: GuestStatus }) {
  const t = useTranslations("Guests.status");
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full px-3 text-sm text-charcoal",
        STATUS_SURFACE[status],
      )}
    >
      <StatusDot status={status} />
      {t(status)}
    </span>
  );
}

type GuestStatusSelectProps = {
  status: GuestStatus;
  onChange: (status: GuestStatus) => void;
  /** Nom complet de l'invité, pour le libellé accessible. */
  guestName?: string;
  id?: string;
  className?: string;
};

/** Sélecteur de statut RSVP, coloré selon la réponse. */
export function GuestStatusSelect({
  status,
  onChange,
  guestName,
  id,
  className,
}: GuestStatusSelectProps) {
  const t = useTranslations("Guests");
  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (isGuestStatus(value)) onChange(value);
      }}
    >
      <SelectTrigger
        id={id}
        size="sm"
        aria-label={guestName ? t("statusLabel", { name: guestName }) : undefined}
        className={cn(
          "rounded-full border-transparent px-3 text-charcoal",
          STATUS_SURFACE[status],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GUEST_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            <StatusDot status={value} />
            {t(`status.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

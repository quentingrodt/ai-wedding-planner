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

/**
 * pill : pastille colorée (formulaires, fiche famille).
 * quiet : simple point de couleur et libellé, pour alléger les listes.
 */
type StatusVariant = "pill" | "quiet";

/** Pastille de statut en lecture seule (témoins). */
export function GuestStatusBadge({
  status,
  variant = "pill",
}: {
  status: GuestStatus;
  variant?: StatusVariant;
}) {
  const t = useTranslations("Guests.status");
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full text-sm",
        variant === "pill" ? ["px-3 text-charcoal", STATUS_SURFACE[status]] : "text-stone",
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
  variant?: StatusVariant;
  className?: string;
};

/** Sélecteur de statut RSVP, coloré selon la réponse. */
export function GuestStatusSelect({
  status,
  onChange,
  guestName,
  id,
  variant = "pill",
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
          "rounded-full border-transparent px-3",
          variant === "pill"
            ? ["text-charcoal", STATUS_SURFACE[status]]
            : "bg-transparent text-stone shadow-none hover:bg-linen/70 dark:bg-transparent",
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

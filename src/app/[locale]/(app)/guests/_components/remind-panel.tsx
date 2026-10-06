"use client";

import { MessageCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Guest } from "@/lib/guests/schema";
import type { RemindContext } from "./guest-row";
import { RemindGuestDialog } from "./remind-guest-dialog";

/** Au-delà, on renvoie vers le filtre « En attente » plutôt que d'allonger l'encart. */
const MAX_NAMES = 6;

type RemindPanelProps = {
  /** Adultes sans réponse ou incertains, déjà triés. */
  pending: Guest[];
  fullName: (guest: Guest) => string;
  remind: RemindContext;
  onShowAll: () => void;
};

/**
 * Ce qui demande une action, en premier : les réponses attendues,
 * chaque nom ouvrant directement son message de relance.
 */
export function RemindPanel({ pending, fullName, remind, onShowAll }: RemindPanelProps) {
  const t = useTranslations("Guests.remindPanel");
  const [target, setTarget] = useState<Guest | null>(null);
  const [open, setOpen] = useState(false);

  const shown = pending.slice(0, MAX_NAMES);
  const rest = pending.length - shown.length;

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-terracotta-soft/40 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-2xl">
          {t("title", { count: pending.length })}
        </h2>
        <p className="text-sm text-stone">{t("description")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {shown.map((guest) => (
          <li key={guest.id}>
            <button
              type="button"
              onClick={() => {
                setTarget(guest);
                setOpen(true);
              }}
              aria-label={t("remind", { name: fullName(guest) })}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-card px-3.5 text-sm text-charcoal ring-1 ring-border transition-colors hover:bg-ivory focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <MessageCircleIcon aria-hidden strokeWidth={1.5} className="size-4 text-terracotta" />
              {fullName(guest)}
            </button>
          </li>
        ))}
        {rest > 0 && (
          <li>
            <button
              type="button"
              onClick={onShowAll}
              className="inline-flex h-9 items-center rounded-full px-3.5 text-sm text-stone underline-offset-4 hover:text-charcoal hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {t("showAll")}
            </button>
          </li>
        )}
      </ul>

      {target && (
        // Remontée par invité : le message est rédigé pour la bonne personne.
        <RemindGuestDialog
          key={target.id}
          open={open}
          onOpenChange={setOpen}
          guestName={fullName(target)}
          firstName={target.first_name}
          coupleNames={remind.coupleNames}
          weddingDateLabel={remind.weddingDateLabel}
          rsvpToken={target.rsvp_token}
        />
      )}
    </section>
  );
}

"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import type { GuestFamily } from "@/lib/guests/schema";
import type { LodgingActionResult, LodgingGuest } from "@/lib/lodging/schema";
import { cn } from "@/lib/utils";
import { setNeedsLodging } from "../actions";

type FarGuestsProps = {
  /** Invités qui n'ont pas décliné. */
  guests: LodgingGuest[];
  families: GuestFamily[];
  canEdit: boolean;
  /** Ouvert d'office tant que personne n'est marqué. */
  defaultOpen: boolean;
  summary: string;
};

const fullName = (guest: LodgingGuest) => [guest.first_name, guest.last_name].filter(Boolean).join(" ");

/** « Qui vient de loin ? » : un foyer se marque d'un geste, un invité seul aussi. */
export function FarGuests({ guests, families, canEdit, defaultOpen, summary }: FarGuestsProps) {
  const t = useTranslations("Lodging");
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  // Le choix s'affiche aussitôt ; la page rechargée par le serveur fait foi ensuite.
  const [flags, applyFlags] = useOptimistic(
    new Map(guests.map((guest) => [guest.id, guest.needs_lodging])),
    (current, change: { ids: string[]; value: boolean }) => {
      const next = new Map(current);
      for (const id of change.ids) next.set(id, change.value);
      return next;
    },
  );

  function toggle(ids: string[], value: boolean) {
    if (!canEdit || ids.length === 0) return;
    startTransition(async () => {
      applyFlags({ ids, value });
      const result = await setNeedsLodging({ guestIds: ids, needsLodging: value }).catch(
        (): LodgingActionResult => ({ ok: false, error: "generic" }),
      );
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  const households = families
    .map((family) => ({ family, members: guests.filter((guest) => guest.family_id === family.id) }))
    .filter(({ members }) => members.length > 0);
  const solos = guests.filter((guest) => guest.family_id === null);

  return (
    <details open={defaultOpen} className="group rounded-3xl bg-card ring-1 ring-border">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-1">
          <span className="font-serif text-2xl">{t("far.title")}</span>
          <span className="text-stone">{summary}</span>
        </span>
        <ChevronDownIcon aria-hidden className="mt-2 size-5 shrink-0 text-stone transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-6 px-6 pb-6">
        {guests.length === 0 ? (
          <p className="rounded-2xl bg-linen px-5 py-6 text-center text-stone">
            {t.rich("far.noGuests", {
              link: (chunks) => (
                <Link href="/guests" className="text-sage-deep underline underline-offset-4">{chunks}</Link>
              ),
            })}
          </p>
        ) : (
          <>
            <p className="text-sm text-stone">{canEdit ? t("far.lead") : t("far.leadReadOnly")}</p>

            {households.length > 0 && (
              <ul className="flex flex-col gap-2">
                {households.map(({ family, members }) => {
                  const flagged = members.filter((member) => flags.get(member.id)).length;
                  const all = flagged === members.length;
                  const open = expanded === family.id;
                  return (
                    <li key={family.id} className="rounded-2xl bg-linen/60">
                      <div className="flex items-center gap-2 p-2">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : family.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-linen focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <ChevronDownIcon aria-hidden className={cn("size-4 shrink-0 text-stone transition-transform", !open && "-rotate-90")} />
                          <span className="truncate font-medium">{family.name}</span>
                          <span className="shrink-0 text-sm text-stone">
                            {flagged > 0 && !all
                              ? t("far.partial", { count: flagged, total: members.length })
                              : t("far.members", { count: members.length })}
                          </span>
                        </button>
                        <FarToggle
                          pressed={all}
                          disabled={!canEdit}
                          label={t("far.toggleHousehold", { name: family.name })}
                          onClick={() => toggle(members.map((member) => member.id), !all)}
                        />
                      </div>
                      {open && (
                        <ul className="flex flex-wrap gap-2 px-4 pb-3">
                          {members.map((member) => (
                            <li key={member.id}>
                              <GuestChip
                                name={fullName(member)}
                                isChild={member.is_child}
                                pressed={flags.get(member.id) ?? false}
                                disabled={!canEdit}
                                onClick={() => toggle([member.id], !flags.get(member.id))}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {solos.length > 0 && (
              <div className="flex flex-col gap-3">
                {households.length > 0 && (
                  <p className="text-xs font-medium tracking-[0.15em] text-stone uppercase">{t("far.solos")}</p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {solos.map((guest) => (
                    <li key={guest.id}>
                      <GuestChip
                        name={fullName(guest)}
                        isChild={guest.is_child}
                        pressed={flags.get(guest.id) ?? false}
                        disabled={!canEdit}
                        onClick={() => toggle([guest.id], !flags.get(guest.id))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function FarToggle({
  pressed,
  disabled,
  label,
  onClick,
}: {
  pressed: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const t = useTranslations("Lodging");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default",
        pressed ? "bg-sage-deep text-white ring-sage-deep" : "bg-card text-stone ring-border enabled:hover:bg-sage-soft",
      )}
    >
      {pressed && <CheckIcon aria-hidden className="size-4" />}
      {t("far.farAway")}
    </button>
  );
}

function GuestChip({
  name,
  isChild,
  pressed,
  disabled,
  onClick,
}: {
  name: string;
  isChild: boolean;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("Lodging");
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm ring-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default",
        pressed ? "bg-sage-soft text-sage-deep ring-sage" : "bg-card text-charcoal ring-border enabled:hover:bg-linen",
      )}
    >
      {pressed && <CheckIcon aria-hidden className="size-4" />}
      {name}
      {isChild && <span className="text-xs text-stone">{t("far.child")}</span>}
    </button>
  );
}

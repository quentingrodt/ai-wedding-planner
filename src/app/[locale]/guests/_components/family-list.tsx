"use client";

import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { summarizeFamily, type Guest, type GuestFamily } from "@/lib/guests/schema";
import { FamilyComposition } from "./family-composition";

export type FamilyGroup = {
  family: GuestFamily;
  members: Guest[];
};

type FamilyListProps = {
  groups: FamilyGroup[];
  /** Invités sans famille correspondant aux filtres. */
  unassigned: Guest[];
  fullName: (guest: Guest) => string;
  onOpen: (familyId: string) => void;
};

const ANSWER_SEGMENTS = [
  { key: "confirmed", color: "bg-sage" },
  { key: "pending", color: "bg-sand" },
  { key: "declined", color: "bg-terracotta/70" },
] as const;

/** Cartes des familles, puis les invités qui n'en ont pas. */
export function FamilyList({ groups, unassigned, fullName, onOpen }: FamilyListProps) {
  const t = useTranslations("Guests");

  return (
    <div className="flex flex-col gap-8">
      {groups.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map(({ family, members }) => {
            const summary = summarizeFamily(members);
            const total = members.length;
            return (
              <li key={family.id}>
                <button
                  type="button"
                  onClick={() => onOpen(family.id)}
                  className="group flex w-full flex-col gap-4 rounded-3xl bg-card p-5 text-left ring-1 ring-border transition-colors hover:bg-linen/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-serif text-2xl leading-tight wrap-break-word">
                        {family.name}
                      </span>
                      <FamilyComposition summary={summary} className="text-sm text-stone" />
                    </span>
                    <ChevronRightIcon
                      aria-hidden
                      className="mt-1 size-5 shrink-0 text-stone transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  {total > 0 && (
                    <span className="flex flex-col gap-2">
                      <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-linen">
                        {ANSWER_SEGMENTS.map(({ key, color }) =>
                          summary[key] > 0 ? (
                            <span
                              key={key}
                              className={color}
                              style={{ width: `${(summary[key] / total) * 100}%` }}
                            />
                          ) : null,
                        )}
                      </span>
                      <span className="text-xs text-stone">
                        {t("families.answers.confirmedOf", {
                          confirmed: summary.confirmed,
                          total,
                        })}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {unassigned.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium tracking-[0.15em] text-stone uppercase">
            {t("families.unassigned", { count: unassigned.length })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {unassigned.map((guest) => (
              <li
                key={guest.id}
                className="rounded-full bg-linen px-3 py-1 text-sm text-charcoal"
              >
                {fullName(guest)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

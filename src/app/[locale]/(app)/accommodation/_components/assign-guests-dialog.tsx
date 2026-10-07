"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GuestFamily } from "@/lib/guests/schema";
import { lodgingNeeds } from "@/lib/lodging/plan";
import type { Lodging, LodgingActionResult, LodgingGuest } from "@/lib/lodging/schema";
import { assignGuests } from "../actions";

type AssignGuestsDialogProps = {
  lodging: Lodging;
  /** Invités venant de loin (sans les invités qui ont décliné). */
  guests: LodgingGuest[];
  families: GuestFamily[];
  /** Nom de chaque hébergement, pour signaler qui est déjà logé ailleurs. */
  lodgingNames: Map<string, string>;
  trigger: ReactNode;
};

const fullName = (guest: LodgingGuest) => [guest.first_name, guest.last_name].filter(Boolean).join(" ");

/** « Qui dort ici ? » : les foyers venant de loin, à cocher en entier ou invité par invité. */
export function AssignGuestsDialog({ lodging, guests, families, lodgingNames, trigger }: AssignGuestsDialogProps) {
  const t = useTranslations("Lodging");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial = () => new Set(guests.filter((guest) => guest.lodging_id === lodging.id).map((guest) => guest.id));
  const [selected, setSelected] = useState<Set<string>>(initial);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setSelected(initial());
  }

  function toggle(ids: string[], value: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await assignGuests({ lodgingId: lodging.id, guestIds: [...selected] }).catch(
        (): LodgingActionResult => ({ ok: false, error: "generic" }),
      );
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(t("assign.saved", { name: lodging.name, count: selected.size }));
      setOpen(false);
    });
  }

  const groups = [
    ...families.map((family) => ({
      id: family.id,
      name: family.name,
      members: guests.filter((guest) => guest.family_id === family.id),
    })),
    { id: "solos", name: t("far.solos"), members: guests.filter((guest) => guest.family_id === null) },
  ].filter(({ members }) => members.length > 0);

  const chosen = guests.filter((guest) => selected.has(guest.id));
  const { rooms } = lodgingNeeds(chosen.map((guest) => ({ ...guest, needs_lodging: true })));

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("assign.title", { name: lodging.name })}</DialogTitle>
          <DialogDescription>{t("assign.description")}</DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="rounded-2xl bg-linen px-5 py-6 text-center text-stone">{t("assign.noGuests")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => {
              const ids = group.members.map((member) => member.id);
              const count = ids.filter((id) => selected.has(id)).length;
              const all = count === ids.length;
              return (
                <li key={group.id} className="flex flex-col gap-2 rounded-2xl bg-linen/60 p-3">
                  <label className="flex items-center gap-3 font-medium">
                    <input
                      type="checkbox"
                      checked={all}
                      ref={(input) => {
                        if (input) input.indeterminate = count > 0 && !all;
                      }}
                      onChange={() => toggle(ids, !all)}
                      className="size-4 accent-sage-deep"
                    />
                    {group.name}
                  </label>
                  <ul className="flex flex-col gap-1.5 pl-7">
                    {group.members.map((member) => {
                      const elsewhere =
                        member.lodging_id !== null && member.lodging_id !== lodging.id
                          ? lodgingNames.get(member.lodging_id)
                          : undefined;
                      return (
                        <li key={member.id}>
                          <label className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                            <input
                              type="checkbox"
                              checked={selected.has(member.id)}
                              onChange={(event) => toggle([member.id], event.target.checked)}
                              className="size-4 accent-sage-deep"
                            />
                            {fullName(member)}
                            {member.is_child && <span className="text-xs text-stone">{t("far.child")}</span>}
                            {elsewhere && !selected.has(member.id) && (
                              <span className="text-xs text-stone">{t("assign.elsewhere", { name: elsewhere })}</span>
                            )}
                            {elsewhere && selected.has(member.id) && (
                              <span className="text-xs text-terracotta">{t("assign.moving", { name: elsewhere })}</span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-sm text-charcoal">
          {t("assign.summary", { people: chosen.length, rooms })}
          {lodging.rooms !== null && lodging.kind !== "family" && (
            <span className={rooms > lodging.rooms ? "text-terracotta" : "text-stone"}>
              {" "}
              {t("assign.available", { count: lodging.rooms })}
            </span>
          )}
        </p>

        <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" size="lg" disabled={pending} onClick={save} className="h-11 rounded-full px-6">
            {pending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

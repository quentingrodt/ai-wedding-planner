"use client";

import { CheckIcon, PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  familyNameSchema,
  GUEST_LIMITS,
  summarizeFamily,
  type FamilyNameError,
  type Guest,
  type GuestFamily,
  type GuestEvent,
  type GuestStatus,
} from "@/lib/guests/schema";
import { AddGuestDialog } from "./add-guest-dialog";
import { FamilyComposition } from "./family-composition";
import { GuestRow, type RemindContext } from "./guest-row";

type FamilyDetailDialogProps = {
  family: GuestFamily | null;
  members: Guest[];
  /** Invités sans famille, proposés au rattachement. */
  unassigned: Guest[];
  families: GuestFamily[];
  canEdit: boolean;
  fullName: (guest: Guest) => string;
  remind: RemindContext;
  onClose: () => void;
  onStatusChange: (guest: Guest, status: GuestStatus) => void;
  onEventsChange: (guest: Guest, events: GuestEvent[]) => void;
  onAssign: (guest: Guest, familyId: string | null) => void;
  onRename: (family: GuestFamily, name: string) => void;
  onDelete: (family: GuestFamily) => void;
};

/** Fiche d'une famille : composition, réponses et préférences de chacun. */
export function FamilyDetailDialog({
  family,
  members,
  unassigned,
  families,
  canEdit,
  fullName,
  remind,
  onClose,
  onStatusChange,
  onEventsChange,
  onAssign,
  onRename,
  onDelete,
}: FamilyDetailDialogProps) {
  const t = useTranslations("Guests");
  const [renaming, setRenaming] = useState(false);
  const [nameError, setNameError] = useState<FamilyNameError | null>(null);

  function changeOpen(next: boolean) {
    if (next) return;
    setRenaming(false);
    setNameError(null);
    onClose();
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!family) return;
    const parsed = familyNameSchema.safeParse({
      name: String(new FormData(event.currentTarget).get("name") ?? ""),
    });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.code === "too_big" ? "tooLong" : "required");
      return;
    }
    setNameError(null);
    setRenaming(false);
    if (parsed.data.name !== family.name) onRename(family, parsed.data.name);
  }

  const summary = summarizeFamily(members);
  const answers = (["confirmed", "pending", "declined"] as const).filter(
    (key) => summary[key] > 0,
  );

  return (
    <Dialog open={family !== null} onOpenChange={changeOpen}>
      <DialogContent
        closeLabel={t("add.close")}
        className="max-h-[90dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-lg"
      >
        {family && (
          <>
            <DialogHeader className="gap-3">
              <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
                {t("families.detail.eyebrow")}
              </p>
              {renaming ? (
                <form onSubmit={submitRename} className="flex flex-col gap-2" noValidate>
                  <div className="flex items-center gap-2">
                    <Input
                      name="name"
                      defaultValue={family.name}
                      autoFocus
                      autoComplete="off"
                      maxLength={GUEST_LIMITS.familyName}
                      aria-label={t("families.detail.renameLabel")}
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? "family-rename-error" : undefined}
                      className="h-11 font-serif text-xl"
                    />
                    <Button
                      type="submit"
                      size="icon-lg"
                      aria-label={t("families.detail.renameSave")}
                      className="rounded-full"
                    >
                      <CheckIcon aria-hidden />
                    </Button>
                  </div>
                  {nameError && (
                    <p id="family-rename-error" className="text-sm text-destructive">
                      {t(`fieldErrors.${nameError}`)}
                    </p>
                  )}
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <DialogTitle className="font-serif text-3xl leading-tight wrap-break-word">
                    {family.name}
                  </DialogTitle>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("families.detail.rename")}
                      onClick={() => setRenaming(true)}
                      className="mt-1 shrink-0 text-stone"
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                  )}
                </div>
              )}
              <DialogDescription asChild>
                <div className="flex flex-col gap-1">
                  <FamilyComposition summary={summary} className="text-base text-charcoal" />
                  {answers.length > 0 && (
                    <span className="text-sm text-stone">
                      {answers
                        .map((key) => t(`families.answers.${key}`, { count: summary[key] }))
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            {members.length === 0 ? (
              <p className="rounded-3xl bg-linen px-5 py-6 text-center text-stone">
                {t("families.detail.empty")}
              </p>
            ) : (
              <ul className="-mt-3 flex flex-col divide-y divide-border">
                {members.map((guest) => (
                  <GuestRow
                    key={guest.id}
                    guest={guest}
                    fullName={fullName}
                    canEdit={canEdit}
                    remind={remind}
                    onStatusChange={onStatusChange}
                    onEventsChange={onEventsChange}
                    onDetach={(member) => onAssign(member, null)}
                  />
                ))}
              </ul>
            )}

            {canEdit && (
              <div className="flex flex-col gap-3 rounded-3xl bg-linen/60 p-4">
                {unassigned.length > 0 && (
                  <Select
                    value=""
                    onValueChange={(guestId) => {
                      const guest = unassigned.find((candidate) => candidate.id === guestId);
                      if (guest) onAssign(guest, family.id);
                    }}
                  >
                    <SelectTrigger
                      aria-label={t("families.detail.attachLabel")}
                      className="h-11 w-full rounded-full bg-card data-[size=default]:h-11"
                    >
                      <SelectValue placeholder={t("families.detail.attach")} />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {fullName(guest)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <AddGuestDialog
                  families={families}
                  defaultFamilyId={family.id}
                  trigger={
                    <Button size="lg" className="h-11 rounded-full px-5">
                      <UserPlusIcon aria-hidden />
                      {t("families.detail.addMember")}
                    </Button>
                  }
                />
              </div>
            )}

            {canEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-11 w-fit self-center rounded-full text-stone hover:text-terracotta"
                  >
                    <Trash2Icon aria-hidden />
                    {t("families.delete.trigger")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-xl">
                      {t("families.delete.title", { name: family.name })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("families.delete.description")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => onDelete(family)}>
                      {t("families.delete.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

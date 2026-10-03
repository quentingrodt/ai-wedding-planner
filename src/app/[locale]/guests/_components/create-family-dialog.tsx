"use client";

import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUEST_LIMITS, type FamilyNameError } from "@/lib/guests/schema";
import { createFamily } from "../actions";

type CreateFamilyDialogProps = {
  /** Appelé avec l'identifiant de la famille créée, pour ouvrir sa fiche. */
  onCreated: (familyId: string) => void;
};

/** Bouton « Nouvelle famille » et son formulaire en modale. */
export function CreateFamilyDialog({ onCreated }: CreateFamilyDialogProps) {
  const t = useTranslations("Guests");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldError, setFieldError] = useState<FamilyNameError | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setFieldError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");

    startTransition(async () => {
      const result = await createFamily(name);
      if (result.ok) {
        toast(t("families.create.success", { name: name.trim() }));
        changeOpen(false);
        onCreated(result.familyId);
        return;
      }
      setFieldError(result.fieldError ?? null);
      if (result.error !== "invalid") toast.error(t(`errors.${result.error}`));
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 rounded-full px-5">
          <UsersIcon aria-hidden />
          {t("families.create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("add.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("families.create.title")}</DialogTitle>
          <DialogDescription>{t("families.create.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="family-name">{t("families.create.name")}</Label>
            <Input
              id="family-name"
              name="name"
              type="text"
              autoComplete="off"
              placeholder={t("families.create.namePlaceholder")}
              maxLength={GUEST_LIMITS.familyName}
              required
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? "family-name-error" : undefined}
              className="h-11 text-base"
            />
            {fieldError && (
              <p id="family-name-error" className="text-sm text-destructive">
                {t(`fieldErrors.${fieldError}`)}
              </p>
            )}
          </div>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("add.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("families.create.submitting") : t("families.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

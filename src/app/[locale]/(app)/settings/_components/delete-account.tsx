"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/account/actions";
import type { DeletionPlan } from "@/lib/account/deletion-plan";

/**
 * Suppression du compte : ce que deviendra chaque mariage, puis un mot à
 * recopier pour confirmer. Le bouton reste actif pendant l'envoi : la
 * fenêtre ne se ferme qu'en cas d'annulation ou d'échec.
 */
export function DeleteAccount({ plan }: { plan: DeletionPlan }) {
  const t = useTranslations("Settings.account");
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const word = t("confirmWord");
  const confirmed = confirmation.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  function submit() {
    startTransition(async () => {
      const result = await deleteAccount();
      // En cas de succès, l'action redirige vers l'accueil.
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && setConfirmation("")}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="h-11 self-start rounded-full px-5 text-terracotta hover:bg-terracotta-soft/60">
          {t("trigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl">{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="flex flex-col gap-2 text-sm leading-6 text-charcoal">
          {plan.deleted.map((wedding) => (
            <li key={wedding.id}>{t("consequences.deleted", { title: wedding.title })}</li>
          ))}
          {plan.kept.map((wedding) => (
            <li key={wedding.id}>{t("consequences.kept", { title: wedding.title })}</li>
          ))}
          {plan.left.map((wedding) => (
            <li key={wedding.id}>{t("consequences.left", { title: wedding.title })}</li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm text-stone">
            {t("confirmLabel", { word })}
          </label>
          <Input
            id={inputId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="h-11 rounded-full px-4"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <Button variant="destructive" disabled={!confirmed || pending} onClick={submit}>
            {pending ? t("deleting") : t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

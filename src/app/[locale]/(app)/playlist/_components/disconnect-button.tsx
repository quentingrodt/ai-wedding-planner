"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
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
import { disconnectSpotify } from "@/lib/spotify/actions";

/** Délie le compte Spotify, après confirmation. */
export function DisconnectButton() {
  const t = useTranslations("Playlist");
  const [pending, startTransition] = useTransition();

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectSpotify();
      if (!result.ok) toast.error(t(`errors.${result.error}`));
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending} className="rounded-full text-stone">
          {t("disconnect.trigger")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            {t("disconnect.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("disconnect.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("disconnect.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={disconnect}>
            {t("disconnect.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

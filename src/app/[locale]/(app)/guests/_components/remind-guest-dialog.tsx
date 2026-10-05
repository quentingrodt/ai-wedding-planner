"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import { getPathname } from "@/i18n/navigation";

type RemindGuestDialogProps = {
  guestName: string;
  firstName: string;
  /** Prénoms du couple, en signature (weddings.title). */
  coupleNames: string;
  /** Date du mariage déjà formatée, ou null si elle n'est pas fixée. */
  weddingDateLabel: string | null;
  /** Jeton du lien personnel de réponse de l'invité. */
  rsvpToken: string;
};

/**
 * Relance RSVP : un message pré-rédigé, modifiable, avec le lien personnel
 * de réponse de l'invité, à copier puis envoyer depuis sa messagerie. Rien n'est écrit en base : accessible à tous les
 * membres, y compris les témoins, pour décharger les mariés.
 */
export function RemindGuestDialog({
  guestName,
  firstName,
  coupleNames,
  weddingDateLabel,
  rsvpToken,
}: RemindGuestDialogProps) {
  const t = useTranslations("Guests.remind");
  const locale = useLocale();
  // Lien absolu, construit à l'ouverture (l'origine n'existe qu'au navigateur).
  const draft = () => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const link = origin + getPathname({ href: `/i/${rsvpToken}`, locale });
    return weddingDateLabel
      ? t("messageWithDate", { firstName, couple: coupleNames, date: weddingDateLabel, link })
      : t("message", { firstName, couple: coupleNames, link });
  };
  const [message, setMessage] = useState(draft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(t("copied"));
      return;
    } catch {
      // API presse-papiers refusée (fenêtre sans focus, navigateur ancien…) :
      // repli sur la sélection du texte et l'ancienne commande de copie.
    }
    const textarea = textareaRef.current;
    textarea?.select();
    const copied = textarea !== null && document.execCommand("copy");
    if (copied) toast.success(t("copied"));
    else toast.error(t("copyError"));
  }

  return (
    <Dialog onOpenChange={(open) => open && setMessage(draft())}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("button", { name: guestName })}
          className="text-stone hover:bg-sage-soft/60 hover:text-sage-deep"
        >
          <MessageCircleIcon aria-hidden strokeWidth={1.5} />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title", { name: guestName })}</DialogTitle>
          <DialogDescription className="leading-6">{t("description")}</DialogDescription>
        </DialogHeader>

        <label className="sr-only" htmlFor="remind-message">
          {t("textareaLabel")}
        </label>
        <textarea
          ref={textareaRef}
          id="remind-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          className="w-full resize-none rounded-2xl border border-input bg-linen/50 px-4 py-3 text-base leading-7 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />

        <DialogFooter className="mx-0 mt-0 mb-0 flex-row justify-end gap-2 rounded-none border-t-0 bg-transparent p-0">
          <DialogClose asChild>
            <Button variant="ghost" className="h-11 rounded-full px-5 text-stone">
              {t("close")}
            </Button>
          </DialogClose>
          <Button
            onClick={copy}
            className="h-11 rounded-full bg-sage-deep px-5 text-ivory hover:bg-[#35402f]"
          >
            <CopyIcon aria-hidden strokeWidth={1.5} />
            {t("copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

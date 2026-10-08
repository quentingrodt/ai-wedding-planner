"use client";

import { MessageCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sendFeedback } from "@/lib/feedback/actions";
import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, type FeedbackKind } from "@/lib/feedback/schema";
import { usePathname } from "@/i18n/navigation";

/** Entrée du menu qui ouvre la fenêtre de retour. */
export function FeedbackTrigger({ onClick }: { onClick: () => void }) {
  const t = useTranslations("Feedback");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm text-charcoal/80 transition-colors hover:bg-sand/40 hover:text-charcoal"
    >
      <MessageCircleIcon aria-hidden className="size-4.5 text-stone" />
      {t("trigger")}
    </button>
  );
}

/** L'entrée du menu et sa fenêtre, ensemble (menu latéral). */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FeedbackTrigger onClick={() => setOpen(true)} />
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * « Un souci ? Une idée ? » : un retour écrit à chaud, depuis le menu.
 * La page ouverte part avec le message, pour retrouver le contexte.
 * Contrôlée par le parent : sur mobile, elle survit à la fermeture du volet.
 */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Feedback");
  const pathname = usePathname();
  const [kind, setKind] = useState<FeedbackKind>("problem");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const kindId = useId();
  const messageId = useId();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await sendFeedback({ kind, message, page: pathname });
      if (result.ok) {
        toast.success(t("sent"));
        setMessage("");
        setKind("problem");
        onOpenChange(false);
      } else {
        toast.error(t(`errors.${result.error}`));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
          <DialogDescription className="leading-6">{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span id={kindId} className="text-sm font-medium text-charcoal">
              {t("kindLabel")}
            </span>
            <RadioGroup
              aria-labelledby={kindId}
              value={kind}
              onValueChange={(next) => setKind(next as FeedbackKind)}
              className="flex flex-wrap gap-2"
            >
              {FEEDBACK_KINDS.map((option) => (
                <Label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-full bg-linen px-4 py-2.5 text-sm font-normal text-charcoal ring-1 ring-sand transition-colors hover:bg-sage-soft/60 has-[[data-state=checked]]:bg-sage-soft has-[[data-state=checked]]:text-sage-deep has-[[data-state=checked]]:ring-sage"
                >
                  <RadioGroupItem
                    value={option}
                    className="border-stone data-checked:border-sage-deep data-checked:bg-sage-deep"
                  />
                  {t(`kinds.${option}`)}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor={messageId} className="text-sm font-medium text-charcoal">
              {t("messageLabel")}
            </label>
            <textarea
              id={messageId}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t(`placeholders.${kind}`)}
              maxLength={FEEDBACK_MAX_LENGTH}
              required
              rows={5}
              className="w-full resize-none rounded-2xl border border-input bg-linen/50 px-4 py-3 text-base leading-7 placeholder:text-stone/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>

          <DialogFooter className="mx-0 mt-0 mb-0 flex-row justify-end gap-2 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="h-11 rounded-full px-5 text-stone">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || message.trim().length === 0}
              className="h-11 rounded-full bg-sage-deep px-5 text-ivory hover:bg-[#35402f]"
            >
              {pending ? t("sending") : t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

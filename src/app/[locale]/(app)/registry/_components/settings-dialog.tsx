"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
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
import { REGISTRY_LIMITS, type Registry } from "@/lib/registry/schema";
import { updateRegistrySettings } from "../actions";

/** Mot aux invités, boîte à idées et moyen de participer à l'urne. */
export function SettingsDialog({ registry, trigger }: { registry: Registry; trigger: ReactNode }) {
  const t = useTranslations("Registry");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => initialForm(registry));
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const linkInvalid = form.paymentLink.trim() !== "" && !/^https:\/\/\S+$/.test(form.paymentLink.trim());

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setForm(initialForm(registry));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (linkInvalid) return;
    startTransition(async () => {
      const result = await updateRegistrySettings(form).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(t("settings.saved"));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-note">{t("settings.note")}</Label>
            <textarea
              id="settings-note"
              value={form.note}
              maxLength={REGISTRY_LIMITS.note}
              placeholder={t("settings.notePlaceholder")}
              onChange={(event) => set({ note: event.target.value })}
              rows={4}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.acceptsSuggestions}
              onChange={(event) => set({ acceptsSuggestions: event.target.checked })}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-sage"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("settings.suggestions")}</span>
              <span className="text-stone">{t("settings.suggestionsHint")}</span>
            </span>
          </label>
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <p className="font-serif text-lg">{t("settings.paymentTitle")}</p>
            <p className="-mt-1 text-sm text-stone">{t("settings.paymentHint")}</p>
            <Label htmlFor="settings-link">{t("settings.paymentLink")}</Label>
            <Input
              id="settings-link"
              value={form.paymentLink}
              maxLength={REGISTRY_LIMITS.paymentLink}
              aria-invalid={linkInvalid || undefined}
              placeholder={t("settings.paymentLinkPlaceholder")}
              onChange={(event) => set({ paymentLink: event.target.value })}
              className="h-11 rounded-xl bg-card text-base"
            />
            {linkInvalid && <p className="text-sm text-destructive">{t("settings.paymentLinkInvalid")}</p>}
            <Label htmlFor="settings-details">{t("settings.paymentDetails")}</Label>
            <Input
              id="settings-details"
              value={form.paymentDetails}
              maxLength={REGISTRY_LIMITS.paymentDetails}
              placeholder={t("settings.paymentDetailsPlaceholder")}
              onChange={(event) => set({ paymentDetails: event.target.value })}
              className="h-11 rounded-xl bg-card text-base"
            />
          </div>
          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending || linkInvalid} className="h-11 rounded-full px-6">
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(registry: Registry) {
  return {
    note: registry.note ?? "",
    acceptsSuggestions: registry.accepts_suggestions,
    paymentLink: registry.payment_link ?? "",
    paymentDetails: registry.payment_details ?? "",
  };
}

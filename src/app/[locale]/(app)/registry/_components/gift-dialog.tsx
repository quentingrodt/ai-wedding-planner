"use client";

import { LinkIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PASSION_KEYS, ROOM_KEYS, type RegistrySection } from "@/lib/registry/catalog";
import { REGISTRY_LIMITS, type GiftInput, type RegistryGift } from "@/lib/registry/schema";
import { previewProductLink, saveGift } from "../actions";

type GiftDialogProps = {
  /** Cadeau à modifier, ou null pour en créer un. */
  gift: RegistryGift | null;
  /** Devise du mariage : un prix lu dans une autre devise est signalé. */
  currency: string;
  currencySymbol: string;
  trigger: ReactNode;
};

const parseAmount = (value: string) => {
  const amount = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(amount) ? amount : null;
};

/** Ajout ou modification d'un cadeau ; un lien de boutique peut tout pré-remplir. */
export function GiftDialog({ gift, currency, currencySymbol, trigger }: GiftDialogProps) {
  const t = useTranslations("Registry");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fetching, startFetch] = useTransition();
  const [form, setForm] = useState(() => initialForm(gift));
  const [titleError, setTitleError] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setForm(initialForm(gift));
      setTitleError(false);
      setLinkNotice(null);
    }
  }

  function fillFromLink() {
    setLinkNotice(null);
    startFetch(async () => {
      const result = await previewProductLink(form.url).catch(() => ({ ok: false as const, error: "unreachable" as const }));
      if (!result.ok) {
        setLinkNotice(t(`gift.link.${result.error}`));
        return;
      }
      const { title, price, currency: pageCurrency, imageUrl } = result.preview;
      if (!title && price === null && !imageUrl) {
        setLinkNotice(t("gift.link.empty"));
        return;
      }
      set({
        title: title ?? form.title,
        price: price !== null ? String(price) : form.price,
        imageUrl: imageUrl ?? form.imageUrl,
      });
      setLinkNotice(
        pageCurrency && pageCurrency !== currency
          ? t("gift.link.otherCurrency", { currency: pageCurrency })
          : t("gift.link.filled"),
      );
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.title.trim() === "") {
      setTitleError(true);
      return;
    }
    const input: GiftInput = {
      section: form.section,
      title: form.title,
      description: form.description,
      price: parseAmount(form.price),
      quantity: Math.min(REGISTRY_LIMITS.quantity, Math.max(1, parseAmount(form.quantity) ?? 1)),
      url: form.url,
      imageUrl: form.imageUrl,
      isHeirloom: form.isHeirloom,
    };
    startTransition(async () => {
      const result = await saveGift(gift?.id ?? null, input).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(gift ? t("gift.updated") : t("gift.added", { title: form.title.trim() }));
      setOpen(false);
    });
  }

  const urlValid = /^https?:\/\/\S+\.\S+/.test(form.url.trim());

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[92dvh] gap-6 overflow-y-auto rounded-3xl p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{gift ? t("gift.editTitle") : t("gift.addTitle")}</DialogTitle>
          <DialogDescription>{t("gift.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2 rounded-2xl bg-linen/60 p-4">
            <Label htmlFor="gift-url">{t("gift.fields.url")}</Label>
            <div className="flex gap-2">
              <Input
                id="gift-url"
                type="url"
                inputMode="url"
                value={form.url}
                maxLength={REGISTRY_LIMITS.url}
                placeholder="https://"
                onChange={(event) => set({ url: event.target.value })}
                className="h-11 rounded-xl bg-card text-base"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!urlValid || fetching}
                onClick={fillFromLink}
                className="h-11 shrink-0 rounded-xl bg-card px-3"
              >
                <LinkIcon aria-hidden />
                {fetching ? t("gift.link.fetching") : t("gift.link.fill")}
              </Button>
            </div>
            <p aria-live="polite" className="text-xs text-stone">
              {linkNotice ?? t("gift.link.hint")}
            </p>
          </div>

          <div className="flex gap-4">
            {form.imageUrl && (
              // Image d'une boutique tierce : domaine imprévisible, pas d'optimisation next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-24 shrink-0 rounded-xl bg-card object-cover ring-1 ring-border"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="gift-title">{t("gift.fields.title")}</Label>
              <Input
                id="gift-title"
                value={form.title}
                maxLength={REGISTRY_LIMITS.giftTitle}
                aria-invalid={titleError || undefined}
                onChange={(event) => {
                  set({ title: event.target.value });
                  setTitleError(false);
                }}
                className="h-11 rounded-xl bg-card text-base"
              />
              {titleError && <p className="text-sm text-destructive">{t("gift.titleRequired")}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gift-price">{t("gift.fields.price")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gift-price"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(event) => set({ price: event.target.value.replace(/\D/g, "").slice(0, 7) })}
                  className="h-11 rounded-xl bg-card text-base"
                />
                <span className="text-stone">{currencySymbol}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gift-quantity">{t("gift.fields.quantity")}</Label>
              <Input
                id="gift-quantity"
                type="number"
                min={1}
                max={REGISTRY_LIMITS.quantity}
                value={form.quantity}
                onChange={(event) => set({ quantity: event.target.value })}
                className="h-11 w-24 rounded-xl bg-card text-base"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gift-section">{t("gift.fields.section")}</Label>
            <Select value={form.section} onValueChange={(value) => set({ section: value as RegistrySection })}>
              <SelectTrigger id="gift-section" className="h-11 w-full rounded-xl bg-card data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("groups.home")}</SelectLabel>
                  {ROOM_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`sections.${key}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>{t("groups.passions")}</SelectLabel>
                  {PASSION_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`sections.${key}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectItem value="heirloom">{t("sections.heirloom")}</SelectItem>
                  <SelectItem value="other">{t("sections.other")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gift-description">{t("gift.fields.description")}</Label>
            <Input
              id="gift-description"
              value={form.description}
              maxLength={REGISTRY_LIMITS.giftDescription}
              placeholder={t("gift.descriptionPlaceholder")}
              onChange={(event) => set({ description: event.target.value })}
              className="h-11 rounded-xl bg-card text-base"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.isHeirloom}
              onChange={(event) => set({ isHeirloom: event.target.checked })}
              className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-sage"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t("gift.fields.heirloom")}</span>
              <span className="text-stone">{t("gift.heirloomHint")}</span>
            </span>
          </label>

          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("saving") : gift ? t("save") : t("gift.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(gift: RegistryGift | null) {
  return {
    section: gift?.section ?? ("other" as RegistrySection),
    title: gift?.title ?? "",
    description: gift?.description ?? "",
    price: gift?.price != null ? String(gift.price) : "",
    quantity: String(gift?.quantity ?? 1),
    url: gift?.url ?? "",
    imageUrl: gift?.image_url ?? "",
    isHeirloom: gift?.is_heirloom ?? false,
  };
}

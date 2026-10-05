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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAPTION_MAX,
  MOODBOARD_CATEGORIES,
  type MoodboardCategory,
  type MoodboardItem,
} from "@/lib/moodboard/schema";
import { updateMoodboardItem } from "../planche/actions";

const NONE = "none";

/** Légende et catégorie d'une photo de la planche. */
export function MoodboardItemDialog({
  item,
  trigger,
}: {
  item: MoodboardItem;
  trigger: ReactNode;
}) {
  const t = useTranslations("Inspiration.moodboard");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(item.category ?? NONE);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const caption = String(new FormData(event.currentTarget).get("caption") ?? "");
    startTransition(async () => {
      const result = await updateMoodboardItem(item.id, {
        caption,
        category: category === NONE ? null : (category as MoodboardCategory),
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`, { name: "" }));
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setCategory(item.category ?? NONE);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("dialog.close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`caption-${item.id}`}>{t("dialog.caption")}</Label>
            <Input
              id={`caption-${item.id}`}
              name="caption"
              defaultValue={item.caption ?? ""}
              maxLength={CAPTION_MAX}
              placeholder={t("dialog.captionPlaceholder")}
              className="h-11 text-base"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`category-${item.id}`}>{t("dialog.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                id={`category-${item.id}`}
                className="h-11 w-full data-[size=default]:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("dialog.noCategory")}</SelectItem>
                {MOODBOARD_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`categories.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("dialog.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {t("dialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

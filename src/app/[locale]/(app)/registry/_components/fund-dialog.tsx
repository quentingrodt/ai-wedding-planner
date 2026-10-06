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
import { FUND_KINDS, type FundKind } from "@/lib/registry/catalog";
import { REGISTRY_LIMITS, type RegistryFund } from "@/lib/registry/schema";
import { saveFund } from "../actions";
import { FundIcon } from "@/components/registry/fund-icon";

type FundDialogProps = {
  /** Projet à modifier, ou null pour en créer un. */
  fund: RegistryFund | null;
  currencySymbol: string;
  trigger: ReactNode;
};

/** Ajout ou modification d'un projet de l'urne. */
export function FundDialog({ fund, currencySymbol, trigger }: FundDialogProps) {
  const t = useTranslations("Registry");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<FundKind>(fund?.kind ?? "honeymoon");
  const [title, setTitle] = useState(fund?.title ?? "");
  const [description, setDescription] = useState(fund?.description ?? "");
  const [goal, setGoal] = useState(fund?.goal != null ? String(fund.goal) : "");
  const [titleError, setTitleError] = useState(false);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setKind(fund?.kind ?? "honeymoon");
      setTitle(fund?.title ?? t("funds.kinds.honeymoon.defaultTitle"));
      setDescription(fund?.description ?? "");
      setGoal(fund?.goal != null ? String(fund.goal) : "");
      setTitleError(false);
    }
  }

  // Nouveau projet : le titre suit le type tant qu'il n'a pas été retouché.
  function changeKind(next: FundKind) {
    if (!fund && title === t(`funds.kinds.${kind}.defaultTitle`)) setTitle(t(`funds.kinds.${next}.defaultTitle`));
    setKind(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim() === "") {
      setTitleError(true);
      return;
    }
    const amount = Number.parseInt(goal, 10);
    startTransition(async () => {
      const result = await saveFund(fund?.id ?? null, {
        kind,
        title,
        description,
        goal: Number.isFinite(amount) && amount > 0 ? amount : null,
      }).catch(() => ({ ok: false as const, error: "generic" as const }));
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast(fund ? t("funds.updated") : t("funds.added", { title: title.trim() }));
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{fund ? t("funds.editTitle") : t("funds.addTitle")}</DialogTitle>
          <DialogDescription>{t("funds.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fund-kind">{t("funds.fields.kind")}</Label>
            <Select value={kind} onValueChange={(value) => changeKind(value as FundKind)}>
              <SelectTrigger id="fund-kind" className="h-11 w-full rounded-xl bg-card data-[size=default]:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FUND_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    <FundIcon kind={value} className="size-4" />
                    {t(`funds.kinds.${value}.label`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fund-title">{t("funds.fields.title")}</Label>
            <Input
              id="fund-title"
              value={title}
              maxLength={REGISTRY_LIMITS.fundTitle}
              aria-invalid={titleError || undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError(false);
              }}
              className="h-11 rounded-xl bg-card text-base"
            />
            {titleError && <p className="text-sm text-destructive">{t("funds.titleRequired")}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fund-description">{t("funds.fields.description")}</Label>
            <textarea
              id="fund-description"
              value={description}
              maxLength={REGISTRY_LIMITS.fundDescription}
              placeholder={t(`funds.kinds.${kind}.placeholder`)}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base leading-6 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="fund-goal" className="text-sm font-normal text-stone">
              {t("funds.fields.goal")}
            </Label>
            <Input
              id="fund-goal"
              inputMode="numeric"
              value={goal}
              placeholder="3000"
              onChange={(event) => setGoal(event.target.value.replace(/\D/g, "").slice(0, 7))}
              className="h-10 w-28 rounded-xl bg-card text-base"
            />
            <span className="text-stone">{currencySymbol}</span>
          </div>
          <DialogFooter className="mx-0 mt-2 mb-0 rounded-none border-t-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="lg" className="h-11 rounded-full">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={pending} className="h-11 rounded-full px-6">
              {pending ? t("saving") : fund ? t("save") : t("funds.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

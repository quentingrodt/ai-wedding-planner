"use client";

import { BookOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TRADITION_NOTICE } from "@/lib/budget/worksheet";
import { markBudgetIntroSeen } from "../actions";

/**
 * Notice « qui paie quoi » : la répartition selon la tradition, puis
 * l'invitation à s'organiser librement. Ouverte d'elle-même à la première
 * visite, puis à la demande.
 */
export function BudgetIntro({ firstVisit }: { firstVisit: boolean }) {
  const t = useTranslations("Budget.intro");
  const [open, setOpen] = useState(firstVisit);
  const [seen, setSeen] = useState(!firstVisit);

  // Chaque rubrique a ses propres repères : TypeScript ne relie pas la rubrique
  // à ses entrées dans une clé composée, la correspondance vient de TRADITION_NOTICE.
  const entryText = (group: string, entry: string, field: "what" | "who") =>
    t(`groups.${group}.entries.${entry}.${field}` as Parameters<typeof t>[0]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next && !seen) {
      setSeen(true);
      void markBudgetIntroSeen();
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 w-fit rounded-full px-4 text-sage-deep">
          <BookOpenIcon aria-hidden />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("close")}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-3xl"
      >
        <DialogHeader className="gap-3 bg-linen px-6 pt-8 pb-6 text-left sm:px-10 sm:pt-10">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <DialogTitle className="font-serif text-3xl leading-tight font-normal sm:text-4xl">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-base text-pretty text-stone">
            {t("lead")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8 px-6 py-8 sm:px-10">
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {TRADITION_NOTICE.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <dt className="font-serif text-xl">{t(`groups.${group.key}.title`)}</dt>
                {group.entries.map((entry) => (
                  <dd
                    key={entry}
                    className="flex flex-col gap-0.5 border-b border-sand/70 pb-2 text-sm last:border-b-0"
                  >
                    <span className="text-charcoal">
                      {entryText(group.key, entry, "what")}
                    </span>
                    <span className="text-terracotta">
                      {entryText(group.key, entry, "who")}
                    </span>
                  </dd>
                ))}
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3 rounded-3xl bg-sage-soft px-6 py-6">
            <p className="font-serif text-2xl text-sage-deep">{t("today.title")}</p>
            <p className="text-pretty text-charcoal">{t("today.body")}</p>
            <p className="text-pretty text-stone">{t("today.howTo")}</p>
          </div>

          <Button
            size="lg"
            onClick={() => changeOpen(false)}
            className="h-12 w-full rounded-full sm:w-fit sm:self-end sm:px-8"
          >
            {t("start")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

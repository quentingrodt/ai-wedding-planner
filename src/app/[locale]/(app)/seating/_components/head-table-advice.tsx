"use client";

import { LightbulbIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Table d'honneur vue de dessus : un long plateau, les mariés au centre. */
function HeadTableDrawing() {
  return (
    <svg viewBox="0 0 220 96" aria-hidden className="mx-auto w-52">
      {/* Guirlande de décoration au-dessus de la table. */}
      <path d="M20 22 Q110 46 200 22" className="fill-none stroke-sand" strokeWidth={1.4} />
      {[46, 78, 110, 142, 174].map((x, index) => (
        <circle key={x} cx={x} cy={index === 2 ? 34.5 : index % 2 === 0 ? 29 : 32.5} r={3} className="fill-terracotta/70" />
      ))}
      <rect x={28} y={46} width={164} height={24} rx={6} className="fill-ivory stroke-terracotta" strokeWidth={1.6} />
      {/* Les mariés au centre, entourés de leurs proches. */}
      {[52, 78, 142, 168].map((x) => (
        <circle key={x} cx={x} cy={84} r={7} className="fill-sage-soft stroke-sage" strokeWidth={1.3} />
      ))}
      {[102, 118].map((x) => (
        <circle key={x} cx={x} cy={84} r={7.5} className="fill-terracotta-soft stroke-terracotta" strokeWidth={1.3} />
      ))}
    </svg>
  );
}

/**
 * Conseils de la table d'honneur, dans une modale ouverte par l'appelant :
 * avant de la créer, puis à la demande depuis son dessin.
 */
export function HeadTableAdvice({ onAcknowledge }: { onAcknowledge: () => void }) {
  const t = useTranslations("Seating.headTable");
  return (
    <>
      <HeadTableDrawing />
      <DialogHeader className="gap-3 text-center sm:text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
        <DialogTitle className="font-serif text-2xl">{t("title")}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-3 text-base leading-7 text-stone">
            <p>{t("who")}</p>
            <p>{t("decoration")}</p>
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mx-0 mt-2 mb-0 justify-center rounded-none border-t-0 bg-transparent p-0 sm:justify-center">
        <Button size="lg" className="h-11 rounded-full px-6" onClick={onAcknowledge}>
          {t("acknowledge")}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Petit bouton posé sur le dessin de la table d'honneur : il rouvre les conseils. */
export function HeadTableAdviceButton() {
  const t = useTranslations("Seating.headTable");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("reopen")}
          title={t("reopen")}
          className="rounded-full bg-ivory/90 text-stone ring-1 ring-sand hover:bg-terracotta-soft hover:text-terracotta"
        >
          <LightbulbIcon aria-hidden strokeWidth={1.5} />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="gap-6 rounded-3xl p-6 sm:max-w-md">
        <HeadTableAdvice onAcknowledge={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

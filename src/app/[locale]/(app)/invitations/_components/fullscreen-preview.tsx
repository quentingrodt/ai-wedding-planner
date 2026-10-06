"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ResponsiveInvitation,
  type InvitationView,
} from "@/components/invitations/responsive-invitation";
import { CARD_RATIO } from "@/lib/invitations/card";
import type { InvitationDesign } from "@/lib/invitations/schema";
import { cn } from "@/lib/utils";

/** Pages du livret, dans l'ordre où on les feuillette. */
const BOOKLET_VIEWS = ["cover", "inside", "back"] as const satisfies readonly InvitationView[];

/** Place réservée à l'en-tête et aux marges, sous la hauteur de l'écran. */
const CHROME = "9rem";

type FullscreenPreviewProps = {
  design: InvitationDesign;
  watermark?: string;
  /** Page ouverte d'abord : celle de l'aperçu de l'éditeur. */
  initialView: InvitationView;
  /** Déclencheur (bouton ou aperçu cliquable). */
  trigger: ReactNode;
};

/** Aperçu en plein écran, à la plus grande taille que permet l'écran. */
export function FullscreenPreview({ design, watermark, initialView, trigger }: FullscreenPreviewProps) {
  const t = useTranslations("Invitations");
  const booklet = design.format === "booklet";
  const [view, setView] = useState<InvitationView>(initialView);
  const index = BOOKLET_VIEWS.indexOf(view as (typeof BOOKLET_VIEWS)[number]);
  const go = (step: -1 | 1) => {
    const next = BOOKLET_VIEWS[index + step];
    if (next) setView(next);
  };

  function onKeyDown(event: KeyboardEvent) {
    if (!booklet) return;
    if (event.key === "ArrowLeft") go(-1);
    if (event.key === "ArrowRight") go(1);
  }

  // Largeur qui fait tenir la page (ou le livret ouvert) dans la hauteur de l'écran.
  const pages = view === "inside" ? 2 : 1;
  const maxWidth = `calc((100dvh - ${CHROME}) / ${CARD_RATIO} * ${pages})`;

  return (
    <Dialog onOpenChange={(open) => open && setView(initialView)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        closeLabel={t("fullscreen.close")}
        onKeyDown={onKeyDown}
        className="flex h-dvh w-screen max-w-none flex-col items-center gap-0 rounded-none bg-linen p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t("fullscreen.title")}</DialogTitle>

        <div className="flex h-16 w-full shrink-0 items-center justify-center px-14">
          {booklet && (
            <div role="group" aria-label={t("views.label")} className="inline-flex rounded-full bg-card p-1">
              {BOOKLET_VIEWS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-sm text-stone transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    view === value && "bg-linen text-charcoal",
                  )}
                >
                  {t(`views.${value}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full flex-1 items-center justify-center gap-2 px-2 pb-8 sm:gap-6 sm:px-6">
          {booklet && (
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={t("fullscreen.previous")}
              disabled={index <= 0}
              onClick={() => go(-1)}
              className="shrink-0 rounded-full text-stone"
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
          )}
          <div className="flex min-w-0 flex-1 justify-center" style={{ maxWidth }}>
            <ResponsiveInvitation key={view} design={design} view={view} watermark={watermark} />
          </div>
          {booklet && (
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={t("fullscreen.next")}
              disabled={index >= BOOKLET_VIEWS.length - 1}
              onClick={() => go(1)}
              className="shrink-0 rounded-full text-stone"
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { BookOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { InvitationDesign } from "@/lib/invitations/schema";
import { ResponsiveInvitation } from "./responsive-invitation";

/**
 * Faire-part tel que le reçoit l'invité : la carte simple, ou la couverture
 * du livret qu'on ouvre pour lire l'intérieur puis la 4e de couverture.
 */
export function InvitationViewer({ design }: { design: InvitationDesign }) {
  const t = useTranslations("Rsvp.booklet");
  const [open, setOpen] = useState(false);

  if (design.format === "card") return <ResponsiveInvitation design={design} />;

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-5">
        <ResponsiveInvitation design={design} view="cover" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-card px-5 text-sm font-medium text-charcoal ring-1 ring-border transition-colors hover:bg-ivory focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BookOpenIcon aria-hidden className="size-4" strokeWidth={1.5} />
          {t("open")}
        </button>
      </div>
    );
  }

  // Ouvert : les pages se lisent l'une sous l'autre, lisibles sur mobile.
  return (
    <div className="flex flex-col items-center gap-6">
      {(["inside-left", "inside-right", "back"] as const).map((page) => (
        <ResponsiveInvitation key={page} design={design} view={page} />
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-stone underline decoration-stone/40 underline-offset-4 hover:text-charcoal"
      >
        {t("close")}
      </button>
    </div>
  );
}

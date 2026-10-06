"use client";

import { useEffect, useRef, useState } from "react";
import { InvitationBookletPage, InvitationBookletSpread, InvitationCard } from "@/lib/invitations/card";
import type { BookletPage, InvitationDesign } from "@/lib/invitations/schema";
import { BROWSER_FAMILIES } from "./fonts";

/**
 * card — carte simple ; une page du livret (cover, inside-left…) ;
 * inside — l'intérieur ouvert (pages 2 et 3 côte à côte).
 */
export type InvitationView = "card" | "inside" | BookletPage;

/** Vue par défaut : la carte, ou la couverture du livret. */
export const defaultView = (design: InvitationDesign): InvitationView =>
  design.format === "card" ? "card" : "cover";

/** Aperçu à la largeur du conteneur (le rendu est proportionnel à sa largeur). */
export function ResponsiveInvitation({
  design,
  watermark,
  view = defaultView(design),
}: {
  design: InvitationDesign;
  watermark?: string;
  view?: InvitationView;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const props = { design, families: BROWSER_FAMILIES, watermark };
  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <div className="w-fit overflow-hidden rounded-sm shadow-[0_30px_60px_-30px_rgba(43,42,40,0.45)]">
          {view === "card" ? (
            <InvitationCard {...props} width={width} />
          ) : view === "inside" ? (
            <div className="relative">
              <InvitationBookletSpread
                {...props}
                width={Math.floor(width / 2)}
                pages={["inside-left", "inside-right"]}
              />
              {/* Le pli : une ombre douce au centre du livret ouvert. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(43,42,40,0.07)_50%,transparent)]"
              />
            </div>
          ) : (
            <InvitationBookletPage {...props} width={width} page={view} />
          )}
        </div>
      )}
    </div>
  );
}

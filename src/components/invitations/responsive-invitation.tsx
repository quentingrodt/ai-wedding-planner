"use client";

import { useEffect, useRef, useState } from "react";
import { InvitationCard } from "@/lib/invitations/card";
import type { InvitationDesign } from "@/lib/invitations/schema";
import { BROWSER_FAMILIES } from "./fonts";

/** Aperçu à la largeur du conteneur (le rendu est proportionnel à sa largeur). */
export function ResponsiveInvitation({ design, watermark }: { design: InvitationDesign; watermark?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <div className="overflow-hidden rounded-sm shadow-[0_30px_60px_-30px_rgba(43,42,40,0.45)]">
          <InvitationCard
            design={design}
            width={width}
            families={BROWSER_FAMILIES}
            watermark={watermark}
          />
        </div>
      )}
    </div>
  );
}

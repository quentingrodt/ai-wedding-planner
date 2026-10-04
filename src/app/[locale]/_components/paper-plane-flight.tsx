"use client";

import { useRef } from "react";
import { useTimedProgress } from "@/components/ink/reveal-ink";

/*
 * Un avion en papier traverse lentement le bandeau en dessinant un cœur, puis
 * s'envole hors de la section par la droite (la section le masque). Une traînée
 * fine le suit puis s'efface : elle est découpée en tronçons d'opacité
 * décroissante, recalés à chaque frame sur la position de l'avion.
 */

// Tracé dans un viewBox 1200 × 200, confiné à la bande réservée au-dessus des
// piliers : l'avion ne passe jamais sur le texte.
// Le cœur est géométrique : deux lobes circulaires (r = 48, centres à
// x = 557 et 643, y = 62) qui se coupent en V au creux, et deux flancs
// tangents qui convergent vers la pointe (600, 165). L'entrée et la sortie
// prolongent ces flancs : la pointe est un croisement net.
const FLIGHT =
  // Entrée par la gauche, dans l'axe du flanc droit
  "M40 100 C250 95 566.5 195.1 600 165 " +
  // Flanc droit, lobe droit jusqu'au creux, lobe gauche, flanc gauche
  "L675 97.75 A48 48 0 1 0 600 40.7 A48 48 0 1 0 525 97.75 L600 165 " +
  // Sortie dans l'axe du flanc gauche, puis envol hors de la section par la
  // droite (bien au-delà du viewBox, pour les écrans les plus larges)
  "C633.5 195.1 950 210 1300 80 S1900 -40 2300 -60";

/** Durée du vol complet (avion puis effacement de la traînée), en ms. */
const DURATION = 20000;
/** Longueur de la traînée, en unités du viewBox (≈ le tour du cœur). */
const TAIL = 760;
const SEGMENT_OPACITY = [0.9, 0.75, 0.55, 0.35, 0.15];

export function PaperPlaneFlight() {
  const root = useRef<SVGSVGElement>(null);
  const flight = useRef<SVGPathElement>(null);
  const plane = useRef<SVGGElement>(null);
  const segments = useRef<(SVGPathElement | null)[]>([]);
  const heading = useRef<number | null>(null);

  useTimedProgress(
    root,
    (x) => {
      const path = flight.current;
      if (!path || !plane.current) return;
      const length = path.getTotalLength();
      // Vitesse douce aux deux extrémités ; la tête dépasse la fin du tracé
      // pour que la traînée finisse de s'effacer une fois l'avion posé.
      const eased = (1 - Math.cos(Math.PI * x)) / 2;
      const head = eased * (length + TAIL);
      const slice = TAIL / SEGMENT_OPACITY.length;

      segments.current.forEach((segment, i) => {
        if (!segment) return;
        const from = Math.max(0, head - slice * (i + 1));
        const to = Math.min(length, head - slice * i);
        const visible = Math.max(0, to - from);
        segment.style.strokeDasharray = `${visible} ${length * 2}`;
        segment.style.strokeDashoffset = `${-from}`;
      });

      const at = Math.min(head, length);
      const a = path.getPointAtLength(Math.max(0, at - 1));
      const b = path.getPointAtLength(Math.min(length, at + 1));
      const target = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      // Le cap rejoint la tangente progressivement : aux angles du cœur,
      // l'avion vire au lieu de pivoter d'un coup.
      const previous = heading.current;
      const angle =
        previous === null || x === 1
          ? target
          : previous + ((((target - previous + 540) % 360) + 360) % 360 - 180) * 0.12;
      heading.current = angle;
      plane.current.setAttribute(
        "transform",
        `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${angle.toFixed(1)})`,
      );
    },
    { duration: DURATION, threshold: 0.3 },
  );

  return (
    <svg
      ref={root}
      viewBox="0 0 1200 200"
      aria-hidden
      className="pointer-events-none h-full w-full overflow-visible"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path ref={flight} d={FLIGHT} stroke="none" />
      {SEGMENT_OPACITY.map((opacity, i) => (
        <path
          key={opacity}
          ref={(el) => {
            segments.current[i] = el;
          }}
          d={FLIGHT}
          className="stroke-terracotta"
          strokeWidth={1.1}
          strokeOpacity={opacity}
          strokeLinecap="butt"
          style={{ strokeDasharray: "0 99999" }}
        />
      ))}
      <g ref={plane} transform="translate(40 150)">
        {/* Avion en papier, nez à l'origine, orienté vers +x */}
        <g transform="scale(1.15)" className="stroke-charcoal/80" strokeWidth={0.9}>
          <path d="M0 0 L-30 -11 L-19 0 Z" className="fill-ivory" />
          <path d="M0 0 L-19 0 L-24 9 Z" className="fill-linen" />
          <path d="M-19 0 L-30 -11" />
        </g>
      </g>
    </svg>
  );
}

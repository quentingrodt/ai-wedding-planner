"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Avancement temporel (0 → 1, linéaire) d'une animation jouée une seule fois.
 * Elle avance tant que l'élément est visible et se met en pause sinon, pour
 * qu'on ne la manque pas en défilant.
 */
export function useTimedProgress(
  ref: RefObject<Element | null>,
  onProgress: (x: number) => void,
  { duration, threshold = 0.35 }: { duration: number; threshold?: number },
) {
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      callback.current(1);
      return;
    }

    let elapsed = 0;
    let last = 0;
    let frame = 0;

    const tick = (now: number) => {
      elapsed += now - last;
      last = now;
      const x = Math.min(1, elapsed / duration);
      callback.current(x);
      frame = x < 1 ? requestAnimationFrame(tick) : 0;
    };

    callback.current(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !frame && elapsed < duration) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref, duration, threshold]);
}

type RevealInkProps = {
  children: ReactNode;
  className?: string;
  /** Durée du tracé complet, en millisecondes. */
  duration?: number;
};

/**
 * Pilote les dessins au trait : le dessin se trace de lui-même, une seule
 * fois, dès qu'il apparaît à l'écran. Expose la variable CSS `--p` (0 → 1),
 * dont les éléments `.ink` déduisent leur propre avancement (globals.css).
 */
export function RevealInk({ children, className, duration = 4200 }: RevealInkProps) {
  const ref = useRef<HTMLDivElement>(null);
  useTimedProgress(
    ref,
    (x) => {
      // Ease-in-out : la plume ralentit sur les détails de la fin.
      const p = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
      ref.current?.style.setProperty("--p", p.toFixed(4));
    },
    { duration },
  );

  return (
    <div ref={ref} className={className} style={{ "--p": 0 } as React.CSSProperties}>
      {children}
    </div>
  );
}

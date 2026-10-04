"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

type ScrollProgressOptions = {
  /** Avancement atteint sans défilement (dessiné au chargement). */
  floor?: number;
  /** Distance de défilement, en hauteurs d'écran, pour aller de `floor` à 1. */
  distance?: number;
};

/**
 * Avancement lissé (0 → 1) d'un élément au fil du défilement, transmis à
 * `onProgress` à chaque frame. Interpolation pour un rendu « à la plume ».
 */
export function useScrollProgress(
  ref: RefObject<Element | null>,
  onProgress: (p: number) => void,
  { floor = 0, distance = 0.8 }: ScrollProgressOptions = {},
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

    let current = 0;
    let target = 0;
    let frame = 0;

    const measure = () => {
      const vh = window.innerHeight;
      const docTop = el.getBoundingClientRect().top + window.scrollY;
      // Le dessin progresse dès qu'il entre aux trois quarts de l'écran.
      const start = Math.max(0, docTop - vh * 0.75);
      const raw = (window.scrollY - start) / (vh * distance);
      target = floor + (1 - floor) * Math.min(1, Math.max(0, raw));
    };

    const tick = () => {
      current += (target - current) * 0.08;
      if (Math.abs(target - current) < 0.0005) current = target;
      callback.current(current);
      frame = current === target ? 0 : requestAnimationFrame(tick);
    };

    const onScroll = () => {
      measure();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, floor, distance]);
}

type ScrollInkProps = ScrollProgressOptions & {
  children: ReactNode;
  className?: string;
};

/**
 * Pilote les dessins au trait : expose la variable CSS `--p` (0 → 1) selon le
 * défilement. Les éléments `.ink` du dessin en déduisent leur propre avancement
 * (voir globals.css), sans re-render React.
 */
export function ScrollInk({ children, className, ...options }: ScrollInkProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(
    ref,
    (p) => ref.current?.style.setProperty("--p", p.toFixed(4)),
    options,
  );

  return (
    <div ref={ref} className={className} style={{ "--p": 0 } as React.CSSProperties}>
      {children}
    </div>
  );
}

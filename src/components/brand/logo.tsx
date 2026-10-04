import type { CSSProperties } from "react";
import { cn } from "cn";
import { C_GLYPH, LOGO_VIEWBOX } from "./logo-paths";

export const BRAND_NAME = "Céleste";

const appear = (duration: number, delay: number) =>
  ({ "--appear-dur": `${duration}s`, "--appear-delay": `${delay}s` }) as CSSProperties;

/**
 * Logo « Céleste » : un C calligraphié terracotta (Pinyon Script) suivi de
 * « éleste » en Playfair. La taille suit le `font-size` du parent.
 *
 * `animated` : le C puis « éleste » apparaissent en fondu (.logo-appear dans
 * globals.css).
 */
export function Logo({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label={BRAND_NAME}
      className={cn("inline-block h-[2.07em] w-auto overflow-visible", className)}
    >
      <path
        d={C_GLYPH}
        className={cn("fill-terracotta", animated && "logo-appear")}
        style={animated ? appear(1.2, 0.1) : undefined}
      />
      <text
        x={780}
        y={-120}
        fontSize={455}
        letterSpacing={18}
        className={cn("fill-current font-serif", animated && "logo-appear")}
        style={animated ? appear(1.2, 0.35) : undefined}
      >
        éleste
      </text>
    </svg>
  );
}

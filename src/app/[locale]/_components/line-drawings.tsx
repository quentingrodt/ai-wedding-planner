import type { CSSProperties, ReactNode } from "react";

/*
 * Petits dessins au trait des cartes et du bandeau, pilotés par la variable
 * --p de <RevealInk> (voir globals.css pour les classes .ink-*).
 */

const w = (s: number, e: number, extra?: Record<string, string | number>) =>
  ({ "--s": s, "--e": e, ...extra }) as CSSProperties;

function Frame({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 160"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="h-full w-full overflow-visible"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/* ——— Deux flûtes qui se rapprochent et trinquent ——— */

function Flute({ x, side }: { x: number; side: -1 | 1 }) {
  return (
    <g
      className="ink ink-fall"
      style={{
        ...w(0.38, 0.86, { "--dx": `${-side * 10}px`, "--rot": `${-side * 10}deg` }),
        transformOrigin: "50% 100%",
      }}
    >
      <path
        d={`M${x - 10.6} 54 L${x + 10.6} 54 C${x + 10.4} 75 ${x + 7.5} 95 ${x} 100 C${x - 7.5} 95 ${x - 10.4} 75 ${x - 10.6} 54 Z`}
        className="ink ink-fade fill-terracotta-soft/80 stroke-none"
        style={w(0.24, 0.4)}
      />
      {[
        [x - 3, 88],
        [x + 2, 78],
        [x - 1, 66],
      ].map(([cx, cy]) => (
        <circle key={cy} cx={cx} cy={cy} r={0.9} className="ink ink-fade stroke-terracotta/60" style={w(0.4, 0.55)} />
      ))}
      <g className="ink ink-draw" style={w(0.02, 0.3)}>
        <path
          d={`M${x - 11} 40 C${x - 11} 70 ${x - 8} 96 ${x} 102 C${x + 8} 96 ${x + 11} 70 ${x + 11} 40`}
          pathLength={1}
        />
        <ellipse cx={x} cy={40} rx={11} ry={2} pathLength={1} />
        <path d={`M${x} 102 L${x} 144`} pathLength={1} />
        <ellipse cx={x} cy={146} rx={13} ry={2.5} pathLength={1} />
      </g>
    </g>
  );
}

export function GlassesDrawing({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <path d="M40 150 L200 150" pathLength={1} className="ink ink-draw text-sand" style={w(0, 0.2)} />
      <Flute x={80} side={-1} />
      <Flute x={160} side={1} />
      {/* Le tintement */}
      <g className="ink ink-draw text-terracotta" style={w(0.86, 1)}>
        <path d="M113 27 L108 19" pathLength={1} />
        <path d="M120 24 L120 14" pathLength={1} />
        <path d="M127 27 L132 19" pathLength={1} />
      </g>
    </Frame>
  );
}

/* ——— Le carnet qui arrive puis s'ouvre ——— */

const ROWS = [56, 72, 88, 104, 120];

export function NotebookDrawing({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <g className="ink ink-rise" style={w(0, 0.3)}>
        {/* Ombre portée et tranche des pages */}
        <path d="M60 146 L210 146" pathLength={1} className="ink ink-draw text-sand" style={w(0.05, 0.25)} />
        <g className="ink ink-draw text-stone/70" style={w(0.1, 0.3)}>
          <path d="M198 25 L198 135" pathLength={1} />
          <path d="M200.5 28 L200.5 132" pathLength={1} />
        </g>

        {/* Page de droite (sous la couverture) */}
        <rect x={120} y={22} width={76} height={116} rx={3} pathLength={1} className="ink ink-draw" style={w(0, 0.25)} />
        <path d="M132 38 L160 38" pathLength={1} className="ink ink-draw text-terracotta" style={w(0.62, 0.72)} />
        {ROWS.map((y, i) => {
          const s = 0.66 + i * 0.05;
          return (
            <g key={y}>
              <circle cx={135} cy={y} r={2.6} pathLength={1} className="ink ink-draw" style={w(s, s + 0.06)} />
              {i < 2 && (
                <path
                  d={`M133.4 ${y} L134.7 ${y + 1.3} L137 ${y - 1.4}`}
                  pathLength={1}
                  className="ink ink-draw text-terracotta"
                  style={w(s + 0.06, s + 0.1)}
                />
              )}
              <path
                d={`M143 ${y} L${[184, 172, 180, 166, 176][i]} ${y}`}
                pathLength={1}
                className="ink ink-draw text-stone"
                style={w(s + 0.02, s + 0.1)}
              />
            </g>
          );
        })}

        {/* Couverture : pivote autour de la reliure et devient la page de gauche */}
        <g className="ink ink-flip" style={w(0.34, 0.66)}>
          <rect x={120} y={22} width={76} height={116} rx={3} className="fill-card stroke-none" />
          <rect x={120} y={22} width={76} height={116} rx={3} pathLength={1} className="ink ink-draw" style={w(0, 0.25)} />
          <g className="ink-hide">
            <path d="M186 22 L186 138" pathLength={1} className="ink ink-draw text-terracotta/70" style={w(0.12, 0.28)} />
            <g className="ink ink-draw text-stone" style={w(0.15, 0.32)}>
              <circle cx={150} cy={74} r={8} pathLength={1} />
              <circle cx={161} cy={74} r={8} pathLength={1} />
              <path d="M144 100 L167 100" pathLength={1} />
            </g>
          </g>
        </g>

        {/* Reliure, puis la page de gauche qui se révèle */}
        <path d="M120 22 L120 138" pathLength={1} className="ink ink-draw" style={w(0.05, 0.25)} />
        <g className="ink ink-draw text-sage-deep" style={w(0.68, 0.86)}>
          <path d="M70 118 C76 96 86 78 100 62" pathLength={1} />
          <path d="M76 100 Q70 94 66 96 Q70 102 76 100 Z" pathLength={1} />
          <path d="M84 86 Q90 79 95 81 Q90 88 84 86 Z" pathLength={1} />
          <path d="M90 76 Q84 70 80 72 Q84 78 90 76 Z" pathLength={1} />
        </g>
        <g className="ink ink-draw text-stone/70" style={w(0.74, 0.9)}>
          <path d="M56 40 L104 40" pathLength={1} />
          <path d="M56 50 L92 50" pathLength={1} />
        </g>
      </g>
    </Frame>
  );
}

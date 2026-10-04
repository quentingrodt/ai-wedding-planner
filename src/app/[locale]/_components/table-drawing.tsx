import type { CSSProperties } from "react";

/*
 * Table de mariage dressée, au trait fin. Chaque tracé porte une fenêtre
 * [s, e] sur l'avancement global --p fourni par <RevealInk> :
 *   0.00–0.30  la table, la nappe, le vase, les bougies, le couvert
 *   0.28–0.75  les branches poussent, les feuilles apparaissent
 *   0.60–0.85  les fleurs éclosent
 *   0.75–1.00  les bougies s'allument, le vin est servi, un pétale tombe
 */

type Point = readonly [number, number];
type Stem = {
  points: readonly [Point, Point, Point, Point];
  s: number;
  e: number;
  leaves: number[];
};

const w = (s: number, e: number, extra?: Record<string, string | number>) =>
  ({ "--s": s, "--e": e, ...extra }) as CSSProperties;

function bezier([p0, p1, p2, p3]: Stem["points"], t: number) {
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  const d = (i: 0 | 1) =>
    3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]);
  return { x: at(0), y: at(1), angle: (Math.atan2(d(1), d(0)) * 180) / Math.PI };
}

const STEMS: Stem[] = [
  { points: [[200, 264], [196, 220], [176, 170], [150, 120]], s: 0.3, e: 0.58, leaves: [0.25, 0.42, 0.6, 0.78] },
  { points: [[201, 264], [204, 210], [214, 150], [236, 92]], s: 0.32, e: 0.62, leaves: [0.2, 0.36, 0.52, 0.68, 0.84] },
  { points: [[199, 266], [190, 240], [160, 214], [128, 200]], s: 0.28, e: 0.5, leaves: [0.3, 0.5, 0.7, 0.88, 1] },
  { points: [[202, 266], [214, 238], [246, 216], [276, 208]], s: 0.34, e: 0.56, leaves: [0.3, 0.52, 0.74] },
  { points: [[200, 264], [200, 220], [198, 180], [194, 150]], s: 0.3, e: 0.5, leaves: [0.35, 0.6, 0.85] },
];

const LEAF = "M0 0 Q7 -5.5 15 0 Q7 5.5 0 0 Z";
const PETAL = "M0 0 C-6 -5 -6 -15 0 -18 C6 -15 6 -5 0 0";

function Flower({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((r, i) => (
        <path
          key={r}
          d={PETAL}
          transform={`rotate(${r + 18})`}
          pathLength={1}
          className="ink ink-draw"
          style={w(s + i * 0.03, s + i * 0.03 + 0.1)}
        />
      ))}
      <circle r={2.6} className="ink ink-bloom fill-terracotta/70 stroke-none" style={w(s + 0.12, s + 0.2)} />
    </g>
  );
}

export function TableDrawing({ label }: { label: string }) {
  const [, , , budEnd] = STEMS[3].points;
  const budAngle = bezier(STEMS[3].points, 1).angle + 90;

  return (
    <svg
      viewBox="25 62 350 437.5"
      role="img"
      aria-label={label}
      className="h-full w-full overflow-visible"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Halo des bougies, sous le trait */}
      {[100, 300].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={184}
          r={26}
          className="ink ink-fade fill-terracotta/[0.07] stroke-none"
          style={w(0.8, 0.95)}
        />
      ))}

      {/* Sol */}
      <path d="M44 472 L356 472" pathLength={1} className="ink ink-draw text-sand" style={w(0.1, 0.22)} />

      {/* Plateau de la table */}
      <path d="M70 330 L330 330 L360 352 L40 352 Z" pathLength={1} className="ink ink-draw" style={w(0, 0.14)} />

      {/* Nappe : tombés, plis et ourlet */}
      <path d="M40 352 C38 390 36 420 34 452" pathLength={1} className="ink ink-draw" style={w(0.06, 0.16)} />
      <path d="M360 352 C362 390 364 420 366 452" pathLength={1} className="ink ink-draw" style={w(0.06, 0.16)} />
      <path
        d="M34 452 C80 459 110 448 150 455 S240 449 272 456 S342 449 366 452"
        pathLength={1}
        className="ink ink-draw"
        style={w(0.12, 0.24)}
      />
      {["M104 356 C101 390 107 420 102 450", "M200 356 C203 396 197 424 201 451", "M296 356 C299 390 293 420 298 450"].map(
        (d, i) => (
          <path key={d} d={d} pathLength={1} className="ink ink-draw text-stone/60" style={w(0.14 + i * 0.02, 0.26 + i * 0.02)} />
        ),
      )}

      {/* Vase */}
      <g className="ink ink-draw" style={w(0.12, 0.24)}>
        <path d="M186 330 C177 316 175 296 188 284 C194 278 195 272 194 262" pathLength={1} />
        <path d="M214 330 C223 316 225 296 212 284 C206 278 205 272 206 262" pathLength={1} />
        <ellipse cx={200} cy={262} rx={6} ry={1.6} pathLength={1} />
        <ellipse cx={200} cy={330} rx={14} ry={2.5} pathLength={1} />
      </g>

      {/* Bougeoirs et bougies */}
      {[100, 300].map((x, i) => (
        <g key={x} className="ink ink-draw" style={w(0.15 + i * 0.03, 0.28 + i * 0.03)}>
          <ellipse cx={x} cy={330} rx={12} ry={2.5} pathLength={1} />
          <path d={`M${x} 328 L${x} 318 M${x - 3} 316 L${x + 3} 316 M${x} 314 L${x} 310`} pathLength={1} />
          <path d={`M${x - 9} 306 C${x - 7} 311 ${x + 7} 311 ${x + 9} 306 Z`} pathLength={1} />
          <path d={`M${x - 5} 306 L${x - 5} 196 L${x + 5} 196 L${x + 5} 306`} pathLength={1} />
          <path d={`M${x} 196 L${x} 191`} pathLength={1} />
        </g>
      ))}
      {[100, 300].map((x) => (
        <path
          key={x}
          d={`M${x} 170 C${x + 4.5} 178 ${x + 6} 185 ${x} 190 C${x - 6} 185 ${x - 4.5} 178 ${x} 170 Z`}
          className="ink ink-bloom fill-terracotta-soft stroke-terracotta"
          style={w(0.76, 0.88)}
        />
      ))}

      {/* Assiettes */}
      {[120, 280].map((x, i) => (
        <g key={x} className="ink ink-draw" style={w(0.18 + i * 0.02, 0.3 + i * 0.02)}>
          <ellipse cx={x} cy={342} rx={30} ry={5.5} pathLength={1} />
          <ellipse cx={x} cy={342} rx={19} ry={3.4} pathLength={1} />
        </g>
      ))}

      {/* Verres, puis le vin servi */}
      {[160, 240].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x - 7.5} 314 L${x + 7.5} 314 C${x + 7} 322 ${x + 4} 325 ${x} 325.5 C${x - 4} 325 ${x - 7} 322 ${x - 7.5} 314 Z`}
            className="ink ink-fade fill-terracotta-soft stroke-none"
            style={w(0.84 + i * 0.03, 0.96 + i * 0.03)}
          />
          <g className="ink ink-draw" style={w(0.2 + i * 0.02, 0.32 + i * 0.02)}>
            <ellipse cx={x} cy={346} rx={8} ry={1.8} pathLength={1} />
            <path d={`M${x} 345 L${x} 326`} pathLength={1} />
            <path
              d={`M${x - 9} 298 C${x - 10} 312 ${x - 8} 324 ${x} 326 C${x + 8} 324 ${x + 10} 312 ${x + 9} 298`}
              pathLength={1}
            />
            <ellipse cx={x} cy={298} rx={9} ry={1.6} pathLength={1} />
          </g>
        </g>
      ))}

      {/* Branches et feuillage */}
      {STEMS.map((stem, si) => {
        const [p0, p1, p2, p3] = stem.points;
        return (
          <g key={si} className="text-sage-deep">
            <path
              d={`M${p0[0]} ${p0[1]} C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`}
              pathLength={1}
              className="ink ink-draw"
              style={w(stem.s, stem.e)}
            />
            {stem.leaves.map((t, li) => {
              const { x, y, angle } = bezier(stem.points, t);
              const side = li % 2 === 0 ? -42 : 42;
              const scale = 1.1 - t * 0.35;
              const s = stem.s + (stem.e - stem.s) * t;
              return (
                <path
                  key={t}
                  d={LEAF}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(angle + side).toFixed(1)}) scale(${scale.toFixed(2)})`}
                  pathLength={1}
                  className="ink ink-draw"
                  style={w(s + 0.04, s + 0.16)}
                />
              );
            })}
          </g>
        );
      })}

      {/* Fleurs et bouton */}
      <Flower x={150} y={120} s={0.6} />
      <Flower x={236} y={92} s={0.64} />
      <g transform={`translate(${budEnd[0]} ${budEnd[1]}) rotate(${budAngle.toFixed(1)})`}>
        <path
          d="M0 0 C-4 -4 -4 -10 0 -13 C4 -10 4 -4 0 0 M0 0 L-3 -5 M0 0 L3 -5"
          pathLength={1}
          className="ink ink-draw"
          style={w(0.62, 0.74)}
        />
      </g>

      {/* Un pétale se détache et tombe sur la table */}
      <g transform="translate(150 136)">
        <g className="ink ink-fade" style={w(0.72, 0.8)}>
          <path
            d="M0 0 C-3 -3 -3 -8 0 -9 C3 -8 3 -3 0 0"
            className="ink ink-fall fill-terracotta-soft stroke-terracotta"
            style={w(0.84, 1, { "--dx": "-90px", "--dy": "208px", "--rot": "260deg" })}
          />
        </g>
      </g>
    </svg>
  );
}

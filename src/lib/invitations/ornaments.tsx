import type { InvitationTemplate } from "./schema";

/*
 * Ornements au trait fin de chaque modèle, en SVG simple (path, line,
 * circle) pour rester compatible avec ImageResponse (satori). Dessinés dans
 * un repère 600 × 851 (format A5), mis à l'échelle par le conteneur.
 */
export const CARD_VIEWBOX = { width: 600, height: 851 } as const;

type Point = readonly [number, number];

function bezier(p: readonly [Point, Point, Point, Point], t: number) {
  const u = 1 - t;
  const at = (i: 0 | 1) =>
    u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i];
  const d = (i: 0 | 1) =>
    3 * u * u * (p[1][i] - p[0][i]) + 6 * u * t * (p[2][i] - p[1][i]) + 3 * t * t * (p[3][i] - p[2][i]);
  return { x: at(0), y: at(1), angle: (Math.atan2(d(1), d(0)) * 180) / Math.PI };
}

/** Feuille en amande, orientée selon la tige. */
function leafPath(x: number, y: number, angle: number, size: number) {
  const r = (angle * Math.PI) / 180;
  const rot = (px: number, py: number): string =>
    `${(x + px * Math.cos(r) - py * Math.sin(r)).toFixed(1)} ${(y + px * Math.sin(r) + py * Math.cos(r)).toFixed(1)}`;
  return `M${rot(0, 0)} Q${rot(size * 0.45, -size * 0.38)} ${rot(size, 0)} Q${rot(size * 0.45, size * 0.38)} ${rot(0, 0)} Z`;
}

/** Brin d'olivier : tige + feuilles alternées. */
function sprig(points: readonly [Point, Point, Point, Point], leaves: number, size: number) {
  const parts = [`M${points[0][0]} ${points[0][1]} C${points[1].join(" ")} ${points[2].join(" ")} ${points[3].join(" ")}`];
  for (let i = 1; i <= leaves; i++) {
    const { x, y, angle } = bezier(points, i / (leaves + 0.5));
    parts.push(leafPath(x, y, angle + (i % 2 === 0 ? -40 : 40), size * (1 - i / (leaves * 2.2))));
  }
  return parts.join(" ");
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${CARD_VIEWBOX.width} ${CARD_VIEWBOX.height}`}
      style={{ position: "absolute", top: 0, left: 0 }}
      fill="none"
    >
      {children}
    </svg>
  );
}

/** Ornement du modèle, dans la couleur d'accent de la palette. */
export function Ornament({ template, color }: { template: InvitationTemplate; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (template) {
    // Double filet et coins en volute : l'élégance d'un carton gravé.
    case "classic":
      return (
        <Frame>
          <path d="M30 30 H570 V821 H30 Z" {...stroke} />
          <path d="M42 42 H558 V809 H42 Z" {...stroke} strokeWidth={0.6} />
          {[
            [42, 42, 1, 1],
            [558, 42, -1, 1],
            [42, 809, 1, -1],
            [558, 809, -1, -1],
          ].map(([x, y, sx, sy]) => (
            <path
              key={`${x}-${y}`}
              d={`M${x} ${y + sy * 34} C${x + sx * 4} ${y + sy * 14} ${x + sx * 14} ${y + sy * 4} ${x + sx * 34} ${y} M${x + sx * 10} ${y + sy * 10} m${-sx * 3} 0 a3 3 0 1 0 ${sx * 6} 0 a3 3 0 1 0 ${-sx * 6} 0`}
              {...stroke}
            />
          ))}
          <path d="M270 120 H330 M300 112 V128" {...stroke} strokeWidth={0.8} />
        </Frame>
      );

    // Brins d'olivier croisés en tête, un brin couché en pied.
    case "garden":
      return (
        <Frame>
          <path d={sprig([[300, 150], [262, 128], [228, 96], [196, 70]], 6, 26)} {...stroke} />
          <path d={sprig([[300, 150], [338, 128], [372, 96], [404, 70]], 6, 26)} {...stroke} />
          <path d={sprig([[220, 775], [260, 763], [320, 763], [380, 775]], 7, 18)} {...stroke} strokeWidth={1} />
        </Frame>
      );

    // Soleil levant en tête, vagues en pied.
    case "seaside":
      return (
        <Frame>
          <path d="M250 140 A50 50 0 0 1 350 140" {...stroke} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i * Math.PI) / 8;
            return (
              <line
                key={i}
                x1={300 + Math.cos(a) * 62}
                y1={140 + Math.sin(a) * 62}
                x2={300 + Math.cos(a) * 80}
                y2={140 + Math.sin(a) * 80}
                {...stroke}
                strokeWidth={0.9}
              />
            );
          })}
          <path d="M210 140 H390" {...stroke} strokeWidth={0.8} />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${170 + i * 20} ${764 + i * 16} q25 -14 50 0 t50 0 t50 0 t50 0 t50 0`}
              {...stroke}
              strokeWidth={1.1 - i * 0.2}
            />
          ))}
        </Frame>
      );

    // Arche de verrière et guirlande lumineuse.
    case "loft":
      return (
        <Frame>
          <path d="M44 821 V300 A256 256 0 0 1 556 300 V821" {...stroke} />
          <path d="M56 821 V300 A244 244 0 0 1 544 300 V821" {...stroke} strokeWidth={0.6} />
          <path d="M120 236 Q300 330 480 236" {...stroke} strokeWidth={0.8} />
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i + 1) / 10;
            const x = 120 + 360 * t;
            const y = (1 - t) * (1 - t) * 236 + 2 * (1 - t) * t * 330 + t * t * 236;
            return <circle key={i} cx={x} cy={y + 9} r={3.2} fill={color} stroke="none" />;
          })}
        </Frame>
      );
  }
}

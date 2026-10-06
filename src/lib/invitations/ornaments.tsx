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

/** Feuille ronde d'eucalyptus, attachée à la tige par sa base. */
function roundLeafPath(x: number, y: number, angle: number, size: number) {
  const r = (angle * Math.PI) / 180;
  const rot = (px: number, py: number): string =>
    `${(x + px * Math.cos(r) - py * Math.sin(r)).toFixed(1)} ${(y + px * Math.sin(r) + py * Math.cos(r)).toFixed(1)}`;
  return `M${rot(0, 0)} C${rot(size * 0.2, -size * 0.62)} ${rot(size * 1.05, -size * 0.55)} ${rot(size, 0)} C${rot(size * 1.05, size * 0.55)} ${rot(size * 0.2, size * 0.62)} ${rot(0, 0)} Z`;
}

/** Tige d'eucalyptus : feuilles rondes par paires, plus petites vers la pointe. */
function eucalyptusBranch(points: readonly [Point, Point, Point, Point], pairs: number, size: number) {
  const parts = [`M${points[0][0]} ${points[0][1]} C${points[1].join(" ")} ${points[2].join(" ")} ${points[3].join(" ")}`];
  for (let i = 1; i <= pairs; i++) {
    const { x, y, angle } = bezier(points, i / (pairs + 0.6));
    const leaf = size * (1.1 - (i / pairs) * 0.55);
    parts.push(roundLeafPath(x, y, angle - 68, leaf), roundLeafPath(x, y, angle + 68, leaf));
  }
  const tip = bezier(points, 1);
  parts.push(roundLeafPath(tip.x, tip.y, tip.angle, size * 0.45));
  return parts.join(" ");
}

/** Feuille pointue avec sa nervure centrale. */
function veinedLeafPath(x: number, y: number, angle: number, size: number) {
  const r = (angle * Math.PI) / 180;
  const tipX = x + size * Math.cos(r);
  const tipY = y + size * Math.sin(r);
  return `${leafPath(x, y, angle, size)} M${x.toFixed(1)} ${y.toFixed(1)} L${tipX.toFixed(1)} ${tipY.toFixed(1)}`;
}

/** Rameau d'automne : grandes feuilles nervurées alternées. */
function autumnBranch(points: readonly [Point, Point, Point, Point], leaves: number, size: number) {
  const parts = [`M${points[0][0]} ${points[0][1]} C${points[1].join(" ")} ${points[2].join(" ")} ${points[3].join(" ")}`];
  for (let i = 1; i <= leaves; i++) {
    const { x, y, angle } = bezier(points, i / (leaves + 0.4));
    parts.push(veinedLeafPath(x, y, angle + (i % 2 === 0 ? -48 : 48), size * (1 - i / (leaves * 2.6))));
  }
  return parts.join(" ");
}

/** Grappe de baies au bout d'un pédoncule. */
// Fonction et non composant : satori n'accepte que des éléments natifs dans un <svg>.
function berries(x: number, y: number, color: string) {
  return [
    [0, 0],
    [9, 5],
    [2, 11],
    [-7, 6],
  ].map(([dx, dy]) => (
    <circle key={`${x}-${dx}-${dy}`} cx={x + dx} cy={y + dy} r={4.2} fill={color} stroke="none" />
  ));
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

    // Alliances entrelacées en tête : la frise horaire fait le reste.
    case "chronology":
      return (
        <Frame>
          {[
            [284, 92, -18],
            [314, 98, 14],
          ].map(([cx, cy, rotate]) => (
            <g key={cx} transform={`rotate(${rotate} ${cx} ${cy})`}>
              <ellipse cx={cx} cy={cy} rx={27} ry={18} {...stroke} />
              <ellipse cx={cx} cy={cy - 3} rx={23} ry={13} {...stroke} strokeWidth={0.8} />
            </g>
          ))}
        </Frame>
      );

    // Branches d'eucalyptus en coins opposés : haut droit, bas gauche.
    case "eucalyptus":
      return (
        <Frame>
          <path d={eucalyptusBranch([[612, 30], [560, 60], [520, 95], [455, 128]], 7, 15)} {...stroke} />
          <path d={eucalyptusBranch([[608, 8], [585, 70], [560, 120], [548, 190]], 6, 13)} {...stroke} strokeWidth={1} />
          <path d={eucalyptusBranch([[590, -6], [555, 20], [520, 30], [488, 36]], 5, 11)} {...stroke} strokeWidth={0.9} />
          <path d={eucalyptusBranch([[-12, 820], [40, 790], [80, 755], [140, 728]], 7, 15)} {...stroke} />
          <path d={eucalyptusBranch([[-8, 845], [18, 790], [40, 740], [52, 668]], 6, 13)} {...stroke} strokeWidth={1} />
          <path d={eucalyptusBranch([[10, 860], [50, 840], [90, 832], [120, 826]], 5, 11)} {...stroke} strokeWidth={0.9} />
        </Frame>
      );

    // Rameaux d'automne et baies aux coins hauts, un rameau couché en pied à gauche.
    case "monogram":
      return (
        <Frame>
          <path d={autumnBranch([[-10, 40], [60, 60], [110, 100], [150, 170]], 5, 42)} {...stroke} />
          <path d={autumnBranch([[20, -10], [70, 30], [150, 40], [210, 30]], 4, 34)} {...stroke} strokeWidth={1} />
          <path d="M150 170 Q158 186 170 192" {...stroke} strokeWidth={0.9} />
          {berries(172, 196, color)}
          <path d={autumnBranch([[610, 40], [540, 60], [490, 100], [450, 170]], 5, 42)} {...stroke} />
          <path d={autumnBranch([[580, -10], [530, 30], [450, 40], [390, 30]], 4, 34)} {...stroke} strokeWidth={1} />
          <path d="M450 170 Q442 186 430 192" {...stroke} strokeWidth={0.9} />
          {berries(428, 196, color)}
          <path d={autumnBranch([[-10, 800], [50, 770], [110, 760], [170, 770]], 5, 34)} {...stroke} />
        </Frame>
      );
  }
}

/** Couronne de feuillage du monogramme, dans un repère 200 × 200. */
export function MonogramWreath({ color, size }: { color: string; size: number }) {
  const stroke = { stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const leaves = Array.from({ length: 22 }, (_, i) => {
    // Couronne ouverte en pied : de 110° à 430°.
    const a = ((110 + (i * 320) / 21) * Math.PI) / 180;
    const x = 100 + Math.cos(a) * 78;
    const y = 100 + Math.sin(a) * 78;
    const tangent = (a * 180) / Math.PI + 90;
    return leafPath(x, y, tangent + (i % 2 === 0 ? -35 : 35), 16);
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M100 100 m-78 0 a78 78 0 1 0 156 0 a78 78 0 1 0 -156 0" {...stroke} strokeWidth={1} />
      <path d={leaves} {...stroke} strokeWidth={1.1} />
    </svg>
  );
}

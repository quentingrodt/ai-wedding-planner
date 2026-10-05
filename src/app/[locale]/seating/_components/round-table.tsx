import type { SeatedGuest } from "@/lib/seating/schema";
import { cn } from "@/lib/utils";

/** Repère du dessin (viewBox carré) : plateau au centre, chaises en orbite. */
const SIZE = 240;
const CENTER = SIZE / 2;
const TABLE_RADIUS = 60;
const ORBIT = 92;
const MAX_CHAIR_RADIUS = 16;
/** En deçà, la chaise est trop petite pour porter des initiales lisibles. */
const MIN_LABELLED_RADIUS = 9;

/** Arrondi au centième : Node et le navigateur peuvent diverger sur la dernière décimale de cos/sin (hydratation). */
const round = (value: number) => Math.round(value * 100) / 100;

function initials(guest: SeatedGuest): string {
  const first = guest.first_name.trim().charAt(0);
  const last = guest.last_name?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Table ronde vue de dessus : occupation au centre (« 6/8 ») et une chaise
 * par place, répartie sur le cercle à partir de midi. Les chaises occupées
 * portent les initiales de l'invité.
 */
export function RoundTable({
  capacity,
  seated,
  label,
  fullName,
}: {
  capacity: number;
  seated: readonly SeatedGuest[];
  /** Nom accessible du dessin (table et occupation). */
  label: string;
  fullName: (guest: SeatedGuest) => string;
}) {
  const full = seated.length >= capacity;
  // Rayon des chaises : elles se partagent la circonférence de l'orbite sans se toucher.
  const chairRadius = round(Math.min(MAX_CHAIR_RADIUS, ((Math.PI * ORBIT) / capacity) * 0.8));
  const labelled = chairRadius >= MIN_LABELLED_RADIUS;

  const chairs = Array.from({ length: capacity }, (_, index) => {
    const angle = (index / capacity) * 2 * Math.PI - Math.PI / 2;
    return {
      x: round(CENTER + ORBIT * Math.cos(angle)),
      y: round(CENTER + ORBIT * Math.sin(angle)),
      guest: seated[index] ?? null,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className="mx-auto w-full max-w-60"
    >
      {chairs.map(({ x, y, guest }, index) => (
        <g key={guest?.id ?? `empty-${index}`}>
          {guest && <title>{fullName(guest)}</title>}
          <circle
            cx={x}
            cy={y}
            r={chairRadius}
            className={cn(
              "transition-colors duration-500",
              guest
                ? guest.is_child
                  ? "fill-sand stroke-sand"
                  : "fill-sage-soft stroke-sage"
                : "fill-ivory stroke-sand",
            )}
            strokeWidth={1.5}
          />
          {guest && labelled && (
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-sage-deep font-sans font-medium"
              fontSize={round(chairRadius * 0.78)}
            >
              {initials(guest)}
            </text>
          )}
        </g>
      ))}

      <circle
        cx={CENTER}
        cy={CENTER}
        r={TABLE_RADIUS}
        className={cn(
          "fill-ivory transition-colors duration-500",
          full ? "stroke-terracotta" : "stroke-sage",
        )}
        strokeWidth={2}
      />
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        className={cn("font-serif", full ? "fill-terracotta" : "fill-charcoal")}
        fontSize={30}
      >
        {seated.length}/{capacity}
      </text>
    </svg>
  );
}

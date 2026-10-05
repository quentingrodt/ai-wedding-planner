import { useTranslations } from "next-intl";
import { mix, type PaletteRoles } from "@/lib/inspiration/palette";

/** La palette mise en scène : faire-part, bouquet et table dressée. */
export function PalettePreview({ roles, names }: { roles: PaletteRoles; names: string }) {
  const t = useTranslations("Inspiration.palette.preview");
  const vignette = "flex flex-col gap-2";
  const frame = "aspect-[4/5] w-full overflow-hidden rounded-3xl ring-1 ring-black/5";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Faire-part */}
      <figure className={vignette}>
        <svg viewBox="0 0 200 250" className={frame} role="img" aria-label={t("stationery")}>
          <rect width="200" height="250" fill={mix(roles.secondary, "#ffffff", 0.55)} />
          <rect x="34" y="30" width="132" height="190" rx="3" fill={roles.light} />
          <rect
            x="42"
            y="38"
            width="116"
            height="174"
            rx="2"
            fill="none"
            stroke={roles.accent}
            strokeWidth="0.8"
          />
          <text
            x="100"
            y="92"
            textAnchor="middle"
            fontSize="7"
            letterSpacing="2"
            fill={roles.main}
            className="font-sans uppercase"
          >
            {t("save")}
          </text>
          <text
            x="100"
            y="124"
            textAnchor="middle"
            fontSize="15"
            fill={roles.deep}
            className="font-serif"
          >
            {names.length > 22 ? `${names.slice(0, 21)}…` : names}
          </text>
          <line x1="86" y1="140" x2="114" y2="140" stroke={roles.accent} strokeWidth="1" />
          <rect x="70" y="156" width="60" height="3" rx="1.5" fill={roles.deep} opacity="0.35" />
          <rect x="78" y="165" width="44" height="3" rx="1.5" fill={roles.deep} opacity="0.25" />
        </svg>
        <figcaption className="px-1 text-sm text-stone">{t("stationery")}</figcaption>
      </figure>

      {/* Bouquet : tiges réunies par un ruban, fleurs en dôme. */}
      <figure className={vignette}>
        <svg viewBox="0 0 200 250" className={frame} role="img" aria-label={t("flowers")}>
          <rect width="200" height="250" fill={roles.light} />
          {[
            [84, 128, 95, 222],
            [100, 124, 100, 226],
            [116, 128, 105, 222],
          ].map(([x1, y1, x2, y2]) => (
            <line
              key={x1}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={mix(roles.secondary, roles.deep, 0.55)}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          <ellipse
            cx="56"
            cy="122"
            rx="20"
            ry="8"
            fill={mix(roles.secondary, roles.deep, 0.35)}
            transform="rotate(-35 56 122)"
          />
          <ellipse
            cx="144"
            cy="122"
            rx="20"
            ry="8"
            fill={mix(roles.secondary, roles.deep, 0.35)}
            transform="rotate(35 144 122)"
          />
          <circle cx="66" cy="96" r="20" fill={roles.main} />
          <circle cx="134" cy="96" r="20" fill={roles.main} />
          <circle cx="82" cy="72" r="19" fill={roles.secondary} />
          <circle cx="118" cy="72" r="19" fill={roles.secondary} />
          <circle cx="100" cy="98" r="26" fill={roles.accent} />
          <circle cx="100" cy="56" r="16" fill={roles.main} />
          <circle cx="100" cy="98" r="8" fill={mix(roles.accent, roles.deep, 0.35)} />
          <circle cx="66" cy="96" r="5" fill={mix(roles.main, roles.deep, 0.4)} />
          <circle cx="134" cy="96" r="5" fill={mix(roles.main, roles.deep, 0.4)} />
          <rect x="88" y="168" width="24" height="10" rx="2" fill={roles.accent} />
          <path d="M92 178 L84 200 L92 196 Z" fill={roles.accent} />
          <path d="M108 178 L116 200 L108 196 Z" fill={roles.accent} />
        </svg>
        <figcaption className="px-1 text-sm text-stone">{t("flowers")}</figcaption>
      </figure>

      {/* Table ronde vue de dessus : assiettes, serviettes, centre de table. */}
      <figure className={vignette}>
        <svg viewBox="0 0 200 250" className={frame} role="img" aria-label={t("table")}>
          <rect width="200" height="250" fill={mix(roles.light, roles.secondary, 0.25)} />
          <circle cx="100" cy="125" r="82" fill={roles.light} />
          <circle cx="100" cy="125" r="82" fill="none" stroke={roles.secondary} strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const at = (radius: number) => ({
              x: Math.round((100 + radius * Math.cos(angle)) * 100) / 100,
              y: Math.round((125 + radius * Math.sin(angle)) * 100) / 100,
            });
            const plate = at(58);
            const degrees = Math.round((angle * 180) / Math.PI) + 90;
            // À 20 de l'assiette, perpendiculairement au rayon de la table.
            const napkin = {
              x: Math.round((plate.x - 20 * Math.sin(angle)) * 100) / 100,
              y: Math.round((plate.y + 20 * Math.cos(angle)) * 100) / 100,
            };
            return (
              <g key={i}>
                <circle
                  cx={plate.x}
                  cy={plate.y}
                  r="15"
                  fill="#ffffff"
                  stroke={mix(roles.secondary, roles.deep, 0.2)}
                  strokeWidth="0.8"
                />
                <circle
                  cx={plate.x}
                  cy={plate.y}
                  r="10"
                  fill="none"
                  stroke={roles.accent}
                  strokeWidth="0.7"
                />
                {/* Serviette pliée, posée à gauche de l'assiette. */}
                <rect
                  x={napkin.x - 2.5}
                  y={napkin.y - 7}
                  width="5"
                  height="14"
                  rx="1.5"
                  fill={roles.main}
                  transform={`rotate(${degrees} ${napkin.x} ${napkin.y})`}
                />
              </g>
            );
          })}
          <circle cx="100" cy="125" r="20" fill={mix(roles.secondary, roles.deep, 0.3)} />
          <circle cx="93" cy="119" r="9" fill={roles.main} />
          <circle cx="108" cy="122" r="8" fill={roles.accent} />
          <circle cx="99" cy="133" r="7" fill={roles.secondary} />
        </svg>
        <figcaption className="px-1 text-sm text-stone">{t("table")}</figcaption>
      </figure>
    </div>
  );
}

import { ArrowRightIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { GuestSummary as Summary } from "@/lib/guests/schema";

type GuestSummaryProps = {
  summary: Summary;
  /** Estimation saisie à l'onboarding, ou null. */
  estimate: number | null;
};

/** Réponses des invités : confirmés (Sauge), en attente (Sable), déclinés (Lin). */
export async function GuestSummary({ summary, estimate }: GuestSummaryProps) {
  const [t, format] = await Promise.all([getTranslations("Dashboard.guests"), getFormatter()]);
  const declined = summary.total - summary.confirmed - summary.pending;
  const toAdd = estimate === null ? 0 : estimate - summary.total;
  const share = (count: number) => (summary.total > 0 ? (count / summary.total) * 100 : 0);

  const segments = [
    { key: "confirmed", count: summary.confirmed, swatch: "bg-sage" },
    { key: "pending", count: summary.pending, swatch: "bg-sand" },
    { key: "declined", count: declined, swatch: "bg-linen ring-1 ring-sand" },
  ] as const;

  return (
    <section
      aria-labelledby="guests-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">{t("eyebrow")}</p>
        <h2 id="guests-title" className="text-2xl">
          {t("title")}
        </h2>
      </div>

      {summary.total === 0 ? (
        <p className="text-stone">{t("empty")}</p>
      ) : (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-4xl tabular-nums">
            {format.number(summary.confirmed)}
            <span className="font-sans text-base text-stone">{t("of", { count: summary.total })}</span>
          </p>

          <div
            role="meter"
            aria-label={t("meterLabel")}
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.confirmed}
            aria-valuetext={t("of", { count: summary.total })}
            className="flex h-3 overflow-hidden rounded-full bg-linen"
          >
            <div className="h-full bg-sage transition-[width] duration-700 ease-out" style={{ width: `${share(summary.confirmed)}%` }} />
            <div className="h-full bg-sand transition-[width] duration-700 ease-out" style={{ width: `${share(summary.pending)}%` }} />
          </div>

          <dl className="grid grid-cols-3 gap-3 text-sm">
            {segments.map(({ key, count, swatch }) => (
              <div key={key} className="flex flex-col gap-1">
                <dt className="flex items-center gap-2 text-stone">
                  <span aria-hidden className={`size-2 rounded-full ${swatch}`} />
                  {t(key)}
                </dt>
                <dd className="tabular-nums">{format.number(count)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {toAdd > 0 && estimate !== null && (
        <p className="text-sm text-pretty text-stone">
          {t("toAdd", { count: toAdd, estimate: format.number(estimate) })}
        </p>
      )}

      <Link
        href="/guests"
        className="group mt-auto inline-flex items-center gap-2 self-start text-sm font-medium text-sage-deep"
      >
        {t("seeAll")}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

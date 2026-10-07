"use client";

import { CalendarClockIcon, HandshakeIcon, PiggyBankIcon, PlusIcon, ScaleIcon, type LucideIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { LodgingKind, LodgingTip } from "@/lib/lodging/catalog";
import type { BookingTimeline, GroupLeverage } from "@/lib/lodging/plan";
import { isoDateToUtc } from "@/lib/weddings/dates";

const ICONS: Record<LodgingTip, LucideIcon> = {
  bookEarly: CalendarClockIcon,
  groupRate: HandshakeIcon,
  compare: ScaleIcon,
  budget: PiggyBankIcon,
};

/** Alternatives économiques proposées en un clic, dans l'ordre des messages. */
const BUDGET_KINDS = ["gite", "rental", "guesthouse", "camping", "family"] as const satisfies readonly LodgingKind[];

type LodgingTipsProps = {
  timeline: BookingTimeline;
  leverage: GroupLeverage;
  /** Chambres à prévoir, estimées. */
  rooms: number;
  /** Ouvre la fiche d'un nouvel hébergement de ce type ; absent en lecture seule. */
  onAdd?: (kind: LodgingKind) => void;
};

/** Les quatre astuces, chacune ajustée au mariage : date, nombre de chambres. */
export function LodgingTips({ timeline, leverage, rooms, onAdd }: LodgingTipsProps) {
  const t = useTranslations("Lodging");
  const format = useFormatter();
  const date = (iso: string) =>
    format.dateTime(isoDateToUtc(iso), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  const bookEarly = (
    <>
      <p>
        {timeline.phase === "early"
          ? t("tips.bookEarly.early", { date: date(timeline.blockBy) })
          : t(`tips.bookEarly.${timeline.phase}`)}
      </p>
      {"highSeason" in timeline && timeline.highSeason && <p>{t("tips.bookEarly.highSeason")}</p>}
      {"guestsBy" in timeline && timeline.guestsBy && (
        <p className="text-charcoal">{t("tips.bookEarly.guestsBy", { date: date(timeline.guestsBy) })}</p>
      )}
    </>
  );

  const groupRate = (
    <>
      <p>{t(`tips.groupRate.${leverage}`, { rooms })}</p>
      <p className="text-charcoal">{t("tips.groupRate.ask")}</p>
      <ul className="flex flex-col gap-1">
        {(["discount", "release", "code", "extras"] as const).map((key) => (
          <li key={key} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-terracotta" />
            {t(`tips.groupRate.items.${key}`)}
          </li>
        ))}
      </ul>
    </>
  );

  const compare = (
    <>
      <p>{t("tips.compare.body")}</p>
      <dl className="flex flex-col gap-2">
        {(["hotels", "booking", "homes"] as const).map((key) => (
          <div key={key}>
            <dt className="text-charcoal">{t(`tips.compare.sites.${key}.label`)}</dt>
            <dd>{t(`tips.compare.sites.${key}.names`)}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  const budget = (
    <>
      <p>{t("tips.budget.body")}</p>
      <ul className="flex flex-col gap-1.5">
        {BUDGET_KINDS.map((kind) => (
          <li key={kind} className="flex items-start justify-between gap-3">
            <span>
              <span className="text-charcoal">{t(`kinds.${kind}`)}</span> — {t(`tips.budget.ideas.${kind}`)}
            </span>
            {onAdd && (
              <button
                type="button"
                onClick={() => onAdd(kind)}
                aria-label={t("tips.budget.add", { kind: t(`kinds.${kind}`) })}
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-sage-deep ring-1 ring-border hover:bg-sage-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <PlusIcon aria-hidden className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-charcoal">{t("tips.budget.shuttle")}</p>
    </>
  );

  const bodies: Record<LodgingTip, ReactNode> = { bookEarly, groupRate, compare, budget };

  return (
    <section aria-labelledby="tips-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="tips-title" className="font-serif text-3xl">{t("tips.title")}</h2>
        <p className="text-stone">{t("tips.lead")}</p>
      </div>
      <ol className="grid gap-4 md:grid-cols-2">
        {(Object.keys(bodies) as LodgingTip[]).map((tip, index) => {
          const Icon = ICONS[tip];
          return (
            <li key={tip} className="flex flex-col gap-3 rounded-3xl bg-linen p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-card text-sage-deep ring-1 ring-border">
                  <Icon aria-hidden className="size-5" strokeWidth={1.5} />
                </span>
                <span className="font-serif text-xl text-terracotta tabular-nums">{index + 1}</span>
              </div>
              <h3 className="font-serif text-xl leading-snug">{t(`tips.${tip}.title`)}</h3>
              <div className="flex flex-col gap-2 text-sm leading-6 text-stone">{bodies[tip]}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

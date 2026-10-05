"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanVendor } from "@/lib/plan/allocation";
import type { StoredWeddingPlan } from "@/lib/plan/schema";
import { generateWeddingPlan, type PlanActionResult } from "../actions";

type PlanError = Extract<PlanActionResult, { ok: false }>["error"];

type WeddingPlanSectionProps = {
  initialPlan: StoredWeddingPlan | null;
  /** Les 12 étapes du carnet sont jouées. */
  complete: boolean;
  /** Owner ou partner. */
  canGenerate: boolean;
  currency: string;
};

/** Plan d'accompagnement : préparation à la demande, puis lecture. */
export function WeddingPlanSection({
  initialPlan,
  complete,
  canGenerate,
  currency,
}: WeddingPlanSectionProps) {
  const t = useTranslations("Plan");
  const [plan, setPlan] = useState(initialPlan);
  const [error, setError] = useState<PlanError | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      let result: PlanActionResult;
      try {
        result = await generateWeddingPlan();
      } catch {
        result = { ok: false, error: "generic" };
      }
      if (result.ok) setPlan(result.plan);
      else setError(result.error);
    });
  }

  if (!complete && !plan) {
    return (
      <p className="rounded-2xl bg-linen/70 px-5 py-4 text-sm leading-6 text-stone">
        {t("generate.incomplete")}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-8">
      {canGenerate && complete && (
        <div className="flex flex-col gap-4 rounded-3xl bg-sage-soft/60 p-6 sm:p-8">
          <h2 className="text-3xl leading-tight tracking-tight text-sage-deep">
            {t("generate.title")}
          </h2>
          {!plan && <p className="leading-7 text-sage-deep/90">{t("generate.body")}</p>}
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex h-12 w-fit items-center gap-3 rounded-full bg-sage-deep px-7 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f] disabled:opacity-60"
          >
            {plan ? (
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
            ) : null}
            {plan ? t("generate.regenerate") : t("generate.cta")}
            {!plan && <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />}
          </button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
        </div>
      )}

      {pending ? <PlanSkeleton label={t("generate.generating")} /> : plan && (
        <PlanView stored={plan} currency={currency} />
      )}
    </section>
  );
}

function PlanSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <p className="font-serif text-lg text-stone italic" aria-live="polite">
        {label}
      </p>
      <Skeleton className="h-10 w-3/4 rounded-xl bg-linen" />
      <Skeleton className="h-24 w-full rounded-2xl bg-linen" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-44 rounded-2xl bg-linen" />
        ))}
      </div>
    </div>
  );
}

function PlanView({ stored, currency }: { stored: StoredWeddingPlan; currency: string }) {
  const t = useTranslations("Plan");
  const tVendors = useTranslations("Plan.vendors");
  const format = useFormatter();
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });

  const { plan, allocation } = stored;
  const amountOf = new Map<PlanVendor, number>(allocation.lines.map((l) => [l.vendor, l.amount]));
  // Recommandations dans l'ordre de la répartition (du plus gros poste au plus petit).
  const recommendations = [...plan.recommendations].sort(
    (a, b) => (amountOf.get(b.vendor) ?? 0) - (amountOf.get(a.vendor) ?? 0),
  );
  const largest = allocation.lines[0]?.amount ?? 1;

  return (
    <article className="flex flex-col gap-12">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
          {t("view.eyebrow")} ·{" "}
          {t("view.preparedOn", {
            date: format.dateTime(new Date(stored.createdAt), { dateStyle: "long" }),
          })}
        </p>
        <h2 className="text-4xl leading-tight tracking-tight text-balance">{plan.vision.title}</h2>
        <p className="text-lg leading-8 text-stone">{plan.vision.summary}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-2xl tracking-tight">{t("view.budgetTitle")}</h3>
          <span className="font-serif text-xl tabular-nums">{money(allocation.total)}</span>
        </div>
        <ul className="flex flex-col gap-3">
          {allocation.lines.map(({ vendor, amount }) => (
            <li key={vendor} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-4 text-sm">
                <span>{tVendors(vendor)}</span>
                <span className="tabular-nums">{money(amount)}</span>
              </div>
              <span className="h-1 overflow-hidden rounded-full bg-linen" aria-hidden>
                <span
                  className="block h-full rounded-full bg-terracotta/80"
                  style={{ width: `${(amount / largest) * 100}%` }}
                />
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-4 border-t border-border pt-3 text-sm text-stone">
            <span>{t("view.contingency")}</span>
            <span className="tabular-nums">{money(allocation.contingency)}</span>
          </li>
        </ul>
        <p className="text-xs text-stone/80">{t("view.disclaimer")}</p>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {recommendations.map((rec) => (
          <li key={rec.vendor} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xl leading-snug tracking-tight">{tVendors(rec.vendor)}</h3>
              {amountOf.has(rec.vendor) && (
                <span className="shrink-0 text-sm text-terracotta tabular-nums">
                  {money(amountOf.get(rec.vendor) ?? 0)}
                </span>
              )}
            </div>
            <p className="text-sm leading-6">{rec.proposal}</p>
            {rec.lookFor.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs tracking-[0.15em] text-stone uppercase">{t("view.lookFor")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {rec.lookFor.map((item) => (
                    <span key={item} className="rounded-full bg-linen px-3 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <dl className="mt-auto flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-xs tracking-[0.15em] text-stone uppercase">{t("view.when")}</dt>
                <dd className="leading-6">{rec.when}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-[0.15em] text-stone uppercase">{t("view.tip")}</dt>
                <dd className="leading-6 text-sage-deep">{rec.budgetTip}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {plan.milestones.length > 0 && (
        <section className="flex flex-col gap-5">
          <h3 className="text-2xl tracking-tight">{t("view.milestones")}</h3>
          <ol className="flex flex-col gap-4 border-l border-sand pl-6">
            {plan.milestones.map((milestone) => (
              <li key={`${milestone.when}-${milestone.action}`} className="relative flex flex-col gap-1">
                <span
                  aria-hidden
                  className="absolute top-1.5 -left-[1.85rem] size-2.5 rounded-full bg-terracotta ring-4 ring-ivory"
                />
                <span className="text-xs tracking-[0.15em] text-terracotta uppercase">
                  {milestone.when}
                </span>
                <span className="leading-7">{milestone.action}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-5">
        <h3 className="text-2xl tracking-tight">{t("view.witnesses")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["bachelorette", "bachelor"] as const).map((key) => (
            <div key={key} className="flex flex-col gap-2 rounded-2xl bg-linen/70 p-5">
              <p className="font-serif text-lg">{t(`view.${key}`)}</p>
              <p className="text-sm leading-6 text-stone">{plan.witnesses[key]}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}

import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { TASK_CATALOG, type PlanningHref } from "@/lib/planning/catalog";
import { describePlanning } from "@/lib/planning/listing";
import { addDaysToIsoDate, daysBetween, isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningSetup,
  getPlanningTasks,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import type { PlanningItem } from "./_components/planning-list";
import { PlanningWorkspace } from "./_components/planning-workspace";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/planning">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Planning" });
  return { title: t("metaTitle") };
}

const HREF_BY_KEY = new Map<string, PlanningHref>(
  TASK_CATALOG.flatMap((task) => ("href" in task ? [[task.key, task.href]] : [])),
);

export default async function PlanningPage({ params }: PageProps<"/[locale]/planning">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }

  const [role, rows, setup, t, format] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getPlanningTasks(supabase, wedding.id),
    getPlanningSetup(supabase, wedding.id),
    getTranslations("Planning"),
    getFormatter(),
  ]);
  const canPersonalize = role === "owner" || role === "partner";

  const today = todayIsoDate();
  const weddingDate = wedding.wedding_date;
  const daysLeft = weddingDate === null ? null : daysBetween(today, weddingDate);

  const { entries, tension, doneCount } = describePlanning({
    rows,
    answers: setup.answers,
    countryCode: setup.countryCode,
    weddingDate,
    today,
  });

  const monthLabel = (isoDate: string) =>
    format.dateTime(isoDateToUtc(isoDate), { month: "long", year: "numeric", timeZone: "UTC" });
  const dayLabel = (isoDate: string) =>
    format.dateTime(isoDateToUtc(isoDate), { day: "numeric", month: "long", timeZone: "UTC" });

  // Conseils rédigés pour les étapes les plus sensibles, sinon conseil générique.
  const adviceFor = (key: string) => {
    const adviceKey = `advice.${key}` as Parameters<typeof t>[0];
    return t.has(adviceKey) ? t(adviceKey) : t("advice.default");
  };

  const items = entries.map(
    ({ row, key, category, done, overdue, pace, groupKey }): PlanningItem => ({
      id: row.id,
      label: key ? t(`tasks.${key}`) : row.title,
      dueDate: row.due_date,
      dueLabel: row.due_date === null ? null : dayLabel(row.due_date),
      overdue,
      done,
      category: category ?? "custom",
      categoryLabel: category ? t(`categories.${category}`) : t("custom"),
      custom: row.template_key === null,
      pace,
      advice: pace === "urgent" && key ? adviceFor(key) : null,
      href: key ? (HREF_BY_KEY.get(key) ?? null) : null,
      groupKey,
      groupLabel:
        groupKey === "overdue"
          ? t("groups.overdue")
          : groupKey === "none"
            ? t("groups.none")
            : monthLabel(row.due_date!),
    }),
  );

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {/* Routes API (fichiers téléchargés) : liens classiques, pas de navigation client. */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/planning/pdf?view=list&locale=${locale}`}
              download
              title={t("export.listHint")}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-linen px-5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sage-soft"
            >
              <DownloadIcon aria-hidden className="size-4" />
              {t("export.list")}
            </a>
            <a
              href={`/api/planning/pdf?view=calendar&locale=${locale}`}
              download
              title={t("export.calendarHint")}
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-linen px-5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sage-soft"
            >
              <DownloadIcon aria-hidden className="size-4" />
              {t("export.calendar")}
            </a>
          </div>
          {daysLeft !== null && (
            <div className="flex flex-col gap-1 rounded-3xl bg-linen px-6 py-5">
              {daysLeft < 0 ? (
                <p className="text-stone">{t("past")}</p>
              ) : (
                <>
                  <p className="font-serif text-xl">
                    {t("horizon", { days: daysLeft })}{" "}
                    <span className={tension === "urgent" ? "text-terracotta" : "text-sage-deep"}>
                      {t(`tension.${tension}`)}
                    </span>
                  </p>
                  {items.length > 0 && (
                    <p className="text-sm text-stone">
                      {t("progress", { done: doneCount, total: items.length })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </header>

        <PlanningWorkspace
          items={items}
          today={today}
          latestDate={weddingDate ? addDaysToIsoDate(weddingDate, -1) : null}
          answers={setup.answers}
          canPersonalize={canPersonalize && weddingDate !== null}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

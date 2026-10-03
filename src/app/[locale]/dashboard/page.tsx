import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { summarizeBudget } from "@/lib/budget/schema";
import { isTaskTemplateKey } from "@/lib/tasks/schema";
import { daysBetween, isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import {
  getBudgetItems,
  getCurrentUserId,
  getCurrentWedding,
  getUpcomingTasks,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { BudgetGauge } from "./_components/budget-gauge";
import { TaskTimeline, type TimelineTask } from "./_components/task-timeline";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dashboard">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Dashboard",
  });
  return { title: t("metaTitle") };
}

export default async function DashboardPage({
  params,
}: PageProps<"/[locale]/dashboard">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const supabase = await createClient();
  if (!(await getCurrentUserId(supabase))) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }

  const [tasks, budgetItems, t, format] = await Promise.all([
    getUpcomingTasks(supabase, wedding.id, 5),
    getBudgetItems(supabase, wedding.id),
    getTranslations("Dashboard"),
    getFormatter(),
  ]);

  const today = todayIsoDate();
  const formatDate = (isoDate: string) =>
    format.dateTime(isoDateToUtc(isoDate), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  // Libellés et échéances résolus ici : le composant client reste sans calcul de date.
  const timelineTasks: TimelineTask[] = tasks.map((task) => ({
    id: task.id,
    label: isTaskTemplateKey(task.template_key)
      ? t(`timeline.templates.${task.template_key}`)
      : task.title,
    dueLabel: task.due_date === null ? null : formatDate(task.due_date),
    overdue: task.due_date !== null && task.due_date < today,
    done: task.status === "done",
  }));

  const daysLeft =
    wedding.wedding_date === null ? null : daysBetween(today, wedding.wedding_date);
  const countdown =
    wedding.wedding_date === null || daysLeft === null
      ? t("countdownNoDate")
      : daysLeft < 0
        ? t("countdownPast", { date: formatDate(wedding.wedding_date) })
        : t("countdown", { days: daysLeft });
  const needsAttention = timelineTasks.some((task) => task.overdue);

  const budgetSummary =
    wedding.total_budget === null
      ? null
      : summarizeBudget(wedding.total_budget, budgetItems);

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight tracking-tight text-balance wrap-break-word sm:text-5xl">
            {t("greeting", { names: wedding.title })}
          </h1>
          <p className="text-lg text-pretty text-muted-foreground">
            {countdown}{" "}
            <span className={needsAttention ? "text-terracotta" : "text-sage-deep"}>
              {needsAttention ? t("needsAttention") : t("allGood")}
            </span>
          </p>
        </header>

        <BudgetGauge
          summary={budgetSummary}
          items={budgetItems}
          currency={wedding.currency_code}
        />

        <TaskTimeline tasks={timelineTasks} />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

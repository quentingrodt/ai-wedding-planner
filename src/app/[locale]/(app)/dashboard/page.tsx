import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Link, redirect } from "@/i18n/navigation";
import { summarizeBudget } from "@/lib/budget/schema";
import { INSPIRATION_OPTIONS, INSPIRATION_STEPS } from "@/lib/inspiration/catalog";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";
import { playedSteps } from "@/lib/inspiration/style-dna";
import { isTaskTemplateKey } from "@/lib/tasks/schema";
import { addDaysToIsoDate, daysBetween, isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import {
  getBudgetItems,
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getUpcomingTasks,
  getWeddingStyleDna,
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
  const userId = await getCurrentUserId(supabase);
  if (!userId) {
    return redirect({ href: "/login", locale });
  }
  const wedding = await getCurrentWedding(supabase);
  if (!wedding) {
    return redirect({ href: "/onboarding", locale });
  }

  // Le budget est réservé aux mariés : rien n'est lu ni affiché pour un témoin.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  const canSeeBudget = role === "owner" || role === "partner";

  const [tasks, budgetItems, styleDna, t, tPlanning, format] = await Promise.all([
    getUpcomingTasks(supabase, wedding.id, 5),
    canSeeBudget ? getBudgetItems(supabase, wedding.id) : Promise.resolve([]),
    getWeddingStyleDna(supabase, wedding.id),
    getTranslations("Dashboard"),
    getTranslations("Planning.tasks"),
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
      ? tPlanning(task.template_key)
      : task.title,
    dueDate: task.due_date,
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

  // Carnet d'inspiration : progression et photo du premier lieu aimé.
  const inspirationDone = playedSteps(styleDna.likes).length;
  const inspirationComplete = inspirationDone === INSPIRATION_STEPS.length;
  const inspirationCover =
    INSPIRATION_PHOTOS.venue[styleDna.likes.venue?.[0] ?? styleDna.ambiance ?? INSPIRATION_OPTIONS.venue[0]];

  const budgetSummary =
    !canSeeBudget || wedding.total_budget === null
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

        <Link
          href="/inspiration"
          className="group flex items-center gap-5 overflow-hidden rounded-2xl bg-card p-3 pr-6 ring-1 ring-border transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(43,42,40,0.35)]"
        >
          <span className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={inspirationCover.src}
              alt=""
              fill
              sizes="80px"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-serif text-xl leading-snug">{t("inspiration.title")}</span>
            <span className="flex gap-1" aria-hidden>
              {INSPIRATION_STEPS.map((step, i) => (
                <span
                  key={step}
                  className={`h-0.5 flex-1 rounded-full ${i < inspirationDone ? "bg-terracotta" : "bg-sand"}`}
                />
              ))}
            </span>
            <span className="text-sm text-stone">
              {t("inspiration.progress", { done: inspirationDone, total: INSPIRATION_STEPS.length })}
            </span>
          </span>
          <span className="hidden items-center gap-2 text-sm font-medium text-sage-deep sm:inline-flex">
            {inspirationComplete ? t("inspiration.ctaDone") : t("inspiration.cta")}
            <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        {canSeeBudget && (
          <BudgetGauge
            summary={budgetSummary}
            items={budgetItems}
            currency={wedding.currency_code}
          />
        )}

        <TaskTimeline
          tasks={timelineTasks}
          // Garde-fou du moteur de cascade : pas d'échéance après la veille du mariage.
          latestDate={wedding.wedding_date ? addDaysToIsoDate(wedding.wedding_date, -1) : null}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

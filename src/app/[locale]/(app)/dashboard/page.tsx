import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { WeddingPhotoEditor } from "@/components/wedding-photo/wedding-photo-editor";
import { redirect } from "@/i18n/navigation";
import { summarizeBudget } from "@/lib/budget/schema";
import { essentialBookings } from "@/lib/dashboard/bookings";
import { buildPriorities, isLate } from "@/lib/dashboard/priorities";
import { progressRatio, weddingPhase } from "@/lib/dashboard/progress";
import { summarizeGuests } from "@/lib/guests/schema";
import { INSPIRATION_OPTIONS, INSPIRATION_STEPS } from "@/lib/inspiration/catalog";
import { INSPIRATION_PHOTOS } from "@/lib/inspiration/photos";
import { playedSteps } from "@/lib/inspiration/style-dna";
import { isTaskTemplateKey } from "@/lib/tasks/schema";
import { upcomingPayments } from "@/lib/vendors/payments";
import { expectedGuests } from "@/lib/venues/compare";
import { addDaysToIsoDate, daysBetween, isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import {
  countOverdueTasks,
  getBudgetItems,
  getCalendarEvents,
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuests,
  getTaskProgress,
  getUpcomingTasks,
  getVendors,
  getVenues,
  getWeddingPhotoUrl,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { monogram } from "@/lib/weddings/monogram";
import { createClient } from "@/utils/supabase/client";
import { BookingsGrid } from "./_components/bookings-grid";
import { BudgetGauge } from "./_components/budget-gauge";
import { GuestSummary } from "./_components/guest-summary";
import { InspirationCard } from "./_components/inspiration-card";
import { PriorityList } from "./_components/priority-list";
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

  // Budget, prestataires, lieux et relances sont réservés aux mariés : rien
  // n'est lu ni affiché pour un témoin, qui voit en revanche la liste d'invités.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  const canSeeBudget = role === "owner" || role === "partner";
  const today = todayIsoDate();

  const [
    tasks,
    overdueTasks,
    taskProgress,
    budgetItems,
    vendors,
    venues,
    guests,
    events,
    styleDna,
    t,
    tPlanning,
    format,
    photoUrl,
  ] = await Promise.all([
    getUpcomingTasks(supabase, wedding.id, 5),
    countOverdueTasks(supabase, wedding.id, today),
    getTaskProgress(supabase, wedding.id),
    canSeeBudget ? getBudgetItems(supabase, wedding.id) : Promise.resolve([]),
    canSeeBudget ? getVendors(supabase, wedding.id) : Promise.resolve([]),
    canSeeBudget ? getVenues(supabase, wedding.id) : Promise.resolve([]),
    getGuests(supabase, wedding.id),
    getCalendarEvents(supabase, wedding.id),
    getWeddingStyleDna(supabase, wedding.id),
    getTranslations("Dashboard"),
    getTranslations("Planning.tasks"),
    getFormatter(),
    getWeddingPhotoUrl(wedding.photo_path),
  ]);

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

  const guestSummary = summarizeGuests(guests);
  // Même nombre d'invités attendus que l'échéancier des prestataires.
  const guestCount = expectedGuests(
    guests.filter((guest) => guest.status !== "declined").length,
    wedding.guest_count,
  );
  const priorities = buildPriorities({
    today,
    overdueTasks,
    payments: upcomingPayments(vendors, guestCount, today),
    events,
    pendingGuests: canSeeBudget ? guestSummary.pending : null,
  });
  const needsAttention = priorities.some(isLate);
  const phase = weddingPhase(daysLeft);
  const progress = progressRatio(taskProgress);

  // Carnet d'inspiration : progression et photo du premier lieu aimé.
  const inspirationDone = playedSteps(styleDna.likes).length;
  const inspirationComplete = inspirationDone >= INSPIRATION_STEPS.length;
  const inspirationCover =
    INSPIRATION_PHOTOS.venue[styleDna.likes.venue?.[0] ?? styleDna.ambiance ?? INSPIRATION_OPTIONS.venue[0]];

  const budgetSummary =
    !canSeeBudget || wedding.total_budget === null
      ? null
      : summarizeBudget(wedding.total_budget, budgetItems);

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <WeddingPhotoEditor
            photoUrl={photoUrl}
            initials={monogram(wedding.title)}
            canEdit={canSeeBudget}
            className="mb-2 size-20 sm:size-24"
          />
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
          {(phase !== null || progress !== null) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
              {phase !== null && (
                <span className="font-serif text-xl text-terracotta">{t(`phases.${phase}`)}</span>
              )}
              {progress !== null && (
                <span className="flex min-w-48 flex-1 items-center gap-3">
                  <span
                    role="meter"
                    aria-label={t("progressLabel")}
                    aria-valuemin={0}
                    aria-valuemax={taskProgress.total}
                    aria-valuenow={taskProgress.done}
                    className="relative h-1 flex-1 overflow-hidden rounded-full bg-linen"
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-sage-deep transition-[width] duration-700 ease-out"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-sm text-stone tabular-nums">
                    {t("progress", {
                      percent: format.number(progress, { style: "percent", maximumFractionDigits: 0 }),
                    })}
                  </span>
                </span>
              )}
            </div>
          )}
        </header>

        <PriorityList priorities={priorities} currency={wedding.currency_code} />

        {/* Tant qu'il est à compléter, le carnet reste en haut ; rempli, il descend en vignette. */}
        {!inspirationComplete && <InspirationCard done={inspirationDone} cover={inspirationCover} />}

        {/* Deux colonnes sur grand écran ; les cartes d'une rangée s'alignent en hauteur. */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
          {canSeeBudget && <BookingsGrid bookings={essentialBookings(vendors, venues)} />}

          <GuestSummary summary={guestSummary} estimate={wedding.guest_count} />

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

        {inspirationComplete && <InspirationCard done={inspirationDone} cover={inspirationCover} />}
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

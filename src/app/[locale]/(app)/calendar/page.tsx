import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { isTaskTemplateKey } from "@/lib/tasks/schema";
import { todayIsoDate } from "@/lib/weddings/dates";
import {
  getCalendarEvents,
  getCurrentUserId,
  getCurrentWedding,
  getPlanningTasks,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { CalendarView, type CalendarTask } from "./_components/calendar-view";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/calendar">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Calendar" });
  return { title: t("metaTitle") };
}

export default async function CalendarPage({ params }: PageProps<"/[locale]/calendar">) {
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

  const [events, rows, t, tTasks] = await Promise.all([
    getCalendarEvents(supabase, wedding.id),
    getPlanningTasks(supabase, wedding.id),
    getTranslations("Calendar"),
    getTranslations("Planning.tasks"),
  ]);

  // Échéances du rétroplanning : libellé traduit, sans recopie en base.
  const tasks: CalendarTask[] = rows.flatMap((row) =>
    row.due_date === null
      ? []
      : [
          {
            id: row.id,
            label: isTaskTemplateKey(row.template_key) ? tTasks(row.template_key) : row.title,
            date: row.due_date,
            done: row.status === "done",
          },
        ],
  );

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {/* Route API (fichier téléchargé) : lien classique, pas de navigation client. */}
          <a
            href={`/api/planning/pdf?view=calendar&locale=${locale}`}
            download
            title={t("exportHint")}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-linen px-5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sage-soft"
          >
            <DownloadIcon aria-hidden className="size-4" />
            {t("export")}
          </a>
        </header>

        <CalendarView
          events={events}
          tasks={tasks}
          today={todayIsoDate()}
          weddingDate={wedding.wedding_date}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

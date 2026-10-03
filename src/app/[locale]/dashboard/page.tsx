import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUserId, getCurrentWedding } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";

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

// Tableau de bord provisoire (Sprint 3 : jauge de budget et timeline).
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

  const t = await getTranslations("Dashboard");
  const format = await getFormatter();

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight tracking-tight text-balance wrap-break-word sm:text-5xl">
            {wedding.title}
          </h1>
          {wedding.wedding_date && (
            <p className="text-lg text-muted-foreground">
              {format.dateTime(new Date(`${wedding.wedding_date}T00:00:00Z`), {
                dateStyle: "full",
                timeZone: "UTC",
              })}
            </p>
          )}
        </header>

        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-sage-soft/60 p-4">
            <dt className="text-xs text-sage-deep">{t("budget")}</dt>
            <dd className="font-serif text-2xl tabular-nums">
              {wedding.total_budget === null
                ? "—"
                : format.number(wedding.total_budget, {
                    style: "currency",
                    currency: wedding.currency_code,
                    maximumFractionDigits: 0,
                  })}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-linen p-4">
            <dt className="text-xs text-stone">{t("guests")}</dt>
            <dd className="font-serif text-2xl tabular-nums">
              {wedding.guest_count === null
                ? "—"
                : format.number(wedding.guest_count)}
            </dd>
          </div>
        </dl>

        <p className="text-muted-foreground">{t("comingSoon")}</p>
      </div>
    </main>
  );
}

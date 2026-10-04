import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { Link, redirect } from "@/i18n/navigation";
import { isoDateToUtc } from "@/lib/weddings/dates";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getGuestFamilies,
  getGuests,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { GuestBoard } from "./_components/guest-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/guests">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Guests",
  });
  return { title: t("metaTitle") };
}

export default async function GuestsPage({
  params,
}: PageProps<"/[locale]/guests">) {
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

  const [role, guests, families, t, format] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getGuests(supabase, wedding.id),
    getGuestFamilies(supabase, wedding.id),
    getTranslations("Guests"),
    getFormatter(),
  ]);
  const canEdit = role === "owner" || role === "partner";

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 text-sm text-stone transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {t("back")}
          </Link>
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            {t("intro")}
          </p>
          {!canEdit && (
            <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>
          )}
        </header>

        <GuestBoard
          guests={guests}
          families={families}
          canEdit={canEdit}
          coupleNames={wedding.title}
          weddingDateLabel={
            wedding.wedding_date
              ? format.dateTime(isoDateToUtc(wedding.wedding_date), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })
              : null
          }
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

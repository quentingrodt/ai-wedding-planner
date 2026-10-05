import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { monthsUntil } from "@/lib/budget/schema";
import {
  getBudgetItems,
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getWeddingStyleDna,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { BudgetBoard } from "./_components/budget-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/budget">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Budget",
  });
  return { title: t("metaTitle") };
}

export default async function BudgetPage({ params }: PageProps<"/[locale]/budget">) {
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

  // Le budget est réservé aux mariés : un témoin repart vers le tableau de bord
  // avant toute lecture des lignes.
  const role = await getCurrentMemberRole(supabase, wedding.id, userId);
  if (role !== "owner" && role !== "partner") {
    return redirect({ href: "/dashboard", locale });
  }

  const [items, styleDna, t] = await Promise.all([
    getBudgetItems(supabase, wedding.id),
    getWeddingStyleDna(supabase, wedding.id),
    getTranslations("Budget"),
  ]);

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
        </header>

        <BudgetBoard
          items={items}
          total={wedding.total_budget}
          currency={wedding.currency_code}
          weddingId={wedding.id}
          likes={styleDna.likes}
          monthsLeft={monthsUntil(wedding.wedding_date, new Date())}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getRegistry,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { RegistryBoard } from "./_components/registry-board";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/registry">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Registry" });
  return { title: t("metaTitle") };
}

export default async function RegistryPage({ params }: PageProps<"/[locale]/registry">) {
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

  const [role, { registry, gifts, funds, pledges, suggestions }, t] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getRegistry(supabase, wedding.id),
    getTranslations("Registry"),
  ]);
  const canEdit = role === "owner" || role === "partner";

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
          {!canEdit && <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("readOnly")}</p>}
        </header>

        <RegistryBoard
          registry={registry}
          gifts={gifts}
          funds={funds}
          pledges={pledges}
          suggestions={suggestions}
          currency={wedding.currency_code}
          canEdit={canEdit}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

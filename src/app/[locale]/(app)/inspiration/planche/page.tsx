import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import { MOODBOARD_BUCKET, type MoodboardPhoto } from "@/lib/moodboard/schema";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getMoodboardItems,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { InspirationTabs } from "../_components/inspiration-tabs";
import { MoodboardBoard } from "../_components/moodboard-board";

/** Durée de validité des URL d'affichage des photos (bucket privé). */
const SIGNED_URL_SECONDS = 60 * 60;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inspiration/planche">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Inspiration.moodboard" });
  return { title: t("metaTitle") };
}

export default async function MoodboardPage({
  params,
}: PageProps<"/[locale]/inspiration/planche">) {
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

  const [items, role, t] = await Promise.all([
    getMoodboardItems(supabase, wedding.id),
    getCurrentMemberRole(supabase, wedding.id, userId),
    getTranslations("Inspiration.moodboard"),
  ]);

  // URL signées en une requête (lecture vérifiée par la policy du bucket).
  const paths = items.flatMap((item) => (item.file_path ? [item.file_path] : []));
  const { data: signed } =
    paths.length > 0
      ? await supabase.storage.from(MOODBOARD_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
      : { data: [] };
  const urlByPath = new Map(
    (signed ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [],
    ),
  );
  const photos: MoodboardPhoto[] = items.flatMap((item) =>
    item.kind === "photo" && item.file_path
      ? [{ ...item, kind: "photo" as const, url: urlByPath.get(item.file_path) ?? null }]
      : [],
  );
  const boards = items.filter((item) => item.kind === "pinterest");

  return (
    <main className="flex flex-1 justify-center px-5 pt-8 pb-24 sm:px-6 sm:pt-16">
      <div className="flex w-full min-w-0 max-w-5xl flex-col gap-10">
        <InspirationTabs />
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        <MoodboardBoard
          photos={photos}
          boards={boards}
          currentUserId={userId}
          isCouple={role === "owner" || role === "partner"}
        />
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

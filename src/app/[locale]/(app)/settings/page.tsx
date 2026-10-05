import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "@/i18n/navigation";
import {
  getCurrentMemberRole,
  getCurrentUserId,
  getCurrentWedding,
  getTeamMembers,
} from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { InviteButtons } from "./_components/invite-buttons";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Settings",
  });
  return { title: t("metaTitle") };
}

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
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

  const [role, members, t] = await Promise.all([
    getCurrentMemberRole(supabase, wedding.id, userId),
    getTeamMembers(supabase, wedding.id),
    getTranslations("Settings"),
  ]);

  return (
    <main className="flex flex-1 justify-center px-5 pt-14 pb-24 sm:px-6 sm:pt-20">
      <div className="flex w-full min-w-0 max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">{t("intro")}</p>
        </header>

        <section aria-labelledby="team-heading" className="flex flex-col gap-4">
          <h2 id="team-heading" className="font-serif text-2xl">
            {t("team.title")}
          </h2>
          <ul className="flex flex-col divide-y divide-sand rounded-3xl bg-linen px-6">
            {members.map((member) => {
              const name = member.full_name?.trim() || member.email || t("team.unnamed");
              return (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <span className="min-w-0 truncate">
                    {name}
                    {member.user_id === userId && (
                      <span className="text-stone"> {t("team.you")}</span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full bg-sage-soft px-3 py-1 text-xs text-sage-deep">
                    {t(`roles.${member.role}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="invite-heading" className="flex flex-col gap-4">
          <h2 id="invite-heading" className="font-serif text-2xl">
            {t("invite.title")}
          </h2>
          {role === "owner" ? (
            <>
              <p className="text-muted-foreground">{t("invite.description")}</p>
              <InviteButtons />
            </>
          ) : (
            <p className="rounded-3xl bg-linen px-6 py-5 text-stone">{t("invite.ownerOnly")}</p>
          )}
        </section>
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}

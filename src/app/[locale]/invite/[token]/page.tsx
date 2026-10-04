import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { parseInviteToken } from "@/lib/team/schema";
import { getCurrentUserId, type WeddingRole } from "@/lib/weddings/queries";
import { createClient } from "@/utils/supabase/client";
import { AcceptInviteForm } from "./accept-invite-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/invite/[token]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Settings",
  });
  // Pas d'indexation : l'URL porte un secret.
  return { title: t("accept.metaTitle"), robots: { index: false, follow: false } };
}

/**
 * Page d'arrivée d'un lien d'invitation. L'acceptation passe par un bouton
 * (Server Action, protégée contre le CSRF) et non par le simple chargement de
 * la page : un GET ne doit pas pouvoir faire rejoindre un mariage à notre insu.
 */
export default async function InvitePage({
  params,
}: PageProps<"/[locale]/invite/[token]">) {
  const { locale: rawLocale, token: rawToken } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  const token = parseInviteToken(rawToken);

  const supabase = await createClient();
  if (token && !(await getCurrentUserId(supabase))) {
    // Un invité n'a souvent pas encore de compte : inscription d'abord, le token
    // voyage jusqu'au retour ici (la page propose aussi de se connecter).
    return redirect({ href: { pathname: "/signup", query: { invite: token } }, locale });
  }

  const t = await getTranslations("Settings");

  let invite: { wedding_title: string; role: WeddingRole } | null = null;
  if (token) {
    const { data, error } = await supabase
      .rpc("get_wedding_invite", { p_token: token })
      .maybeSingle<{ wedding_title: string; role: WeddingRole }>();
    if (error) console.error("[team] get_wedding_invite:", error.code);
    invite = data ?? null;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full min-w-0 max-w-md flex-col gap-8 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
          {t("accept.eyebrow")}
        </p>
        {invite && token ? (
          <>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance wrap-break-word">
              {t("accept.title", { names: invite.wedding_title })}
            </h1>
            <p className="text-lg text-pretty text-muted-foreground">
              {t("accept.description", { role: t(`roles.${invite.role}`) })}
            </p>
            <AcceptInviteForm token={token} />
          </>
        ) : (
          <>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
              {t("accept.invalidTitle")}
            </h1>
            <p className="text-lg text-pretty text-muted-foreground">
              {t("accept.invalidDescription")}
            </p>
            <Link
              href="/dashboard"
              className="mx-auto inline-flex w-fit items-center rounded-full bg-linen px-5 py-2.5 text-sm text-sage-deep ring-1 ring-sand transition-colors hover:bg-sand/60"
            >
              {t("accept.toDashboard")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

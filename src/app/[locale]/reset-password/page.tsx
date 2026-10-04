import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/utils/supabase/client";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/reset-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("reset.metaTitle") };
}

/** Atteinte via le lien « mot de passe oublié », qui ouvre une session. */
export default async function ResetPasswordPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) {
    return redirect({ href: { pathname: "/forgot-password", query: { error: "link_expired" } }, locale });
  }

  const t = await getTranslations("Auth");
  return (
    <AuthLayout
      title={t("reset.title")}
      subtitle={t("reset.subtitle", { email: String(data.claims.email ?? "") })}
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}

import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthLayout, authLinkClassName } from "@/components/auth/auth-layout";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/forgot-password">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Auth" });
  return { title: t("forgot.metaTitle") };
}

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const query = await searchParams;
  const t = await getTranslations("Auth");

  return (
    <AuthLayout
      title={t("forgot.title")}
      subtitle={t("forgot.subtitle")}
      footer={
        <Link href="/login" className={authLinkClassName}>
          {t("forgot.back")}
        </Link>
      }
    >
      <ForgotPasswordForm linkExpired={query.error === "link_expired"} />
    </AuthLayout>
  );
}

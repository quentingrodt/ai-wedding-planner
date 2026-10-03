import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { error } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm linkExpired={error === "link_expired"} />
      </div>
    </main>
  );
}

import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { parseHandoff } from "@/lib/onboarding/schema";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const query = await searchParams;
  const t = await getTranslations("Login");

  // Projet éventuellement transmis par Date Night : relayé jusqu'à l'onboarding.
  const handoff = parseHandoff(query);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="flex w-full min-w-0 max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm
          linkExpired={query.error === "link_expired"}
          handoff={handoff}
        />
      </div>
    </main>
  );
}

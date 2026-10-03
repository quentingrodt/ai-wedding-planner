import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "next-intl";

// Écran de test (temporaire) : design system + dictionnaire next-intl.
export default function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  const t = useTranslations("Index");
  const tCommon = useTranslations("Common");

  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-24">
      <header className="absolute inset-x-0 top-0 flex justify-end px-6 py-5">
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline underline-offset-4 decoration-sand transition-colors hover:text-foreground hover:decoration-terracotta"
        >
          {tCommon("login")}
        </Link>
      </header>
      <div className="flex w-full min-w-0 max-w-2xl flex-col items-start gap-8">
        <h1 className="text-5xl leading-tight tracking-tight wrap-break-word sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          {t("subtitle")}
        </p>
        <Button asChild size="lg">
          <Link href="/date-night">{t("dateNight")}</Link>
        </Button>
        <div className="flex gap-3" aria-hidden>
          {["bg-ivory border", "bg-linen", "bg-sand", "bg-sage", "bg-terracotta", "bg-charcoal"].map(
            (c) => (
              <div key={c} className={`size-10 rounded-full ${c}`} />
            ),
          )}
        </div>
      </div>
    </main>
  );
}

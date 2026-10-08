"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Une page a échoué : un mot d'excuse, de quoi réessayer ou revenir à
 * l'accueil. L'erreur part vers Sentry (si configuré) avec son identifiant.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center bg-ivory px-6 py-24">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <p className="text-xs tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
        <h1 className="font-serif text-3xl text-charcoal sm:text-4xl">{t("title")}</h1>
        <p className="leading-7 text-stone">{t("description")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} className="h-11 rounded-full bg-sage-deep px-6 text-ivory hover:bg-[#35402f]">
            {t("retry")}
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-full px-6 text-stone">
            <Link href="/dashboard">{t("home")}</Link>
          </Button>
        </div>
        {error.digest && <p className="text-xs text-stone/70">{t("reference", { digest: error.digest })}</p>}
      </div>
    </main>
  );
}

import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

/** Bandeau mobile : le logo Céleste, qui ramène à l'accueil. */
export async function MobileHeader() {
  const t = await getTranslations("AppNav");
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-sand/60 bg-ivory/90 backdrop-blur-md lg:hidden print:hidden">
      <Link href="/dashboard" aria-label={t("home")} className="text-[1.05rem] text-charcoal">
        <Logo />
      </Link>
    </header>
  );
}

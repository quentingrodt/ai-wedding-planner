import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { Link } from "@/i18n/navigation";
import { guestRegistrySchema, type GuestRegistry } from "@/lib/registry/guest";
import { rsvpTokenSchema } from "@/lib/rsvp/schema";
import { createClient } from "@/utils/supabase/client";
import { GuestRegistryView } from "./guest-registry";

/**
 * Liste vue par l'invité du lien personnel (RPC get_guest_registry, sans
 * compte), ou null si le jeton est invalide ou la liste pas encore ouverte.
 * Mis en cache pour la requête : métadonnées et page lisent la même réponse.
 */
const getGuestRegistry = cache(async (token: string): Promise<GuestRegistry | null> => {
  if (!rsvpTokenSchema.safeParse(token).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_registry", { p_token: token });
  if (error) {
    console.error("[registry] get_guest_registry:", error.code);
    return null;
  }
  const parsed = guestRegistrySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/i/[token]/registry">): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "GuestRegistry" });
  const registry = await getGuestRegistry(token);
  return {
    title: registry ? t("metaTitle", { couple: registry.wedding_title }) : t("notFound.title"),
    // Lien personnel : jamais indexé.
    robots: { index: false, follow: false },
  };
}

export default async function GuestRegistryPage({ params }: PageProps<"/[locale]/i/[token]/registry">) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);
  const [registry, t] = await Promise.all([getGuestRegistry(token), getTranslations("GuestRegistry")]);

  if (!registry) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex max-w-md flex-col gap-4 text-center">
          <h1 className="font-serif text-4xl tracking-tight">{t("notFound.title")}</h1>
          <p className="leading-7 text-stone">{t("notFound.body")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 justify-center bg-linen/40 px-5 pt-10 pb-20 sm:px-6 sm:pt-16">
      <div className="flex w-full min-w-0 max-w-4xl flex-col gap-12">
        <Link
          href={`/i/${token}`}
          className="inline-flex w-fit items-center gap-2 text-sm text-stone transition-colors hover:text-charcoal"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("back")}
        </Link>
        <header className="flex flex-col gap-4">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{registry.wedding_title}</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{t("title")}</h1>
          <p className="text-lg text-stone">{t("hello", { firstName: registry.first_name })}</p>
          {registry.note && (
            <blockquote className="border-l-2 border-sand pl-5 font-serif text-xl leading-relaxed text-pretty">
              {registry.note}
            </blockquote>
          )}
        </header>

        <GuestRegistryView registry={registry} token={token} />

        <Link
          href="/"
          className="self-center text-xs tracking-[0.2em] text-stone/70 uppercase transition-colors hover:text-terracotta"
        >
          {t("madeWith")}
        </Link>
      </div>
    </main>
  );
}

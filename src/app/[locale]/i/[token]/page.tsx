import { GiftIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { InvitationViewer } from "@/components/invitations/invitation-viewer";
import { Link } from "@/i18n/navigation";
import { guestRsvpSchema, rsvpTokenSchema, type GuestRsvp } from "@/lib/rsvp/schema";
import { isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";
import { createClient } from "@/utils/supabase/client";
import { GuestLodgingSection } from "./guest-lodging";
import { RsvpForm } from "./rsvp-form";

/**
 * Invité du lien personnel (RPC get_guest_rsvp, accessible sans compte),
 * ou null si le jeton est invalide. Mis en cache pour la requête :
 * métadonnées et page lisent la même réponse.
 */
const getGuestRsvp = cache(async (token: string): Promise<GuestRsvp | null> => {
  if (!rsvpTokenSchema.safeParse(token).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_rsvp", { p_token: token });
  if (error) {
    console.error("[rsvp] get_guest_rsvp:", error.code);
    return null;
  }
  const parsed = guestRsvpSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/i/[token]">): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "Rsvp" });
  const guest = await getGuestRsvp(token);
  return {
    title: guest ? t("metaTitle", { couple: guest.wedding_title }) : t("notFound.title"),
    // Lien personnel : jamais indexé.
    robots: { index: false, follow: false },
  };
}

export default async function RsvpPage({ params }: PageProps<"/[locale]/i/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);
  const [guest, t, format] = await Promise.all([
    getGuestRsvp(token),
    getTranslations("Rsvp"),
    getFormatter(),
  ]);

  if (!guest) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex max-w-md flex-col gap-4 text-center">
          <h1 className="font-serif text-4xl tracking-tight">{t("notFound.title")}</h1>
          <p className="leading-7 text-stone">{t("notFound.body")}</p>
        </div>
      </main>
    );
  }

  const date = guest.wedding_date
    ? format.dateTime(isoDateToUtc(guest.wedding_date), {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

  return (
    <main className="flex flex-1 justify-center bg-linen/40 px-5 pt-10 pb-20 sm:px-6 sm:pt-16">
      <div className="flex w-full min-w-0 max-w-md flex-col gap-10">
        {guest.design ? (
          <InvitationViewer design={guest.design} />
        ) : (
          <header className="flex flex-col items-center gap-3 rounded-sm bg-ivory px-6 py-16 text-center shadow-[0_30px_60px_-30px_rgba(43,42,40,0.45)]">
            <h1 className="font-serif text-4xl leading-tight tracking-tight">{guest.wedding_title}</h1>
            {date && (
              <p className="text-sm tracking-[0.2em] text-terracotta uppercase">
                {t("fallbackDate", { date })}
              </p>
            )}
          </header>
        )}

        <section className="flex flex-col gap-6">
          <p className="text-lg text-stone">{t("hello", { firstName: guest.first_name })}</p>
          {guest.events && (
            <div className="flex flex-col gap-3 rounded-3xl bg-ivory px-6 py-5 ring-1 ring-border">
              <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">
                {t("events.title")}
              </p>
              <ul className="flex flex-col gap-2">
                {guest.events.map((event) => (
                  <li key={event} className="flex items-center gap-3 font-serif text-xl">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-sage" />
                    {t(`events.${event}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <RsvpForm
            token={token}
            firstName={guest.first_name}
            status={guest.status}
            dietary={guest.dietary_requirements}
          />
        </section>

        {(guest.my_lodging || guest.lodgings.length > 0) && (
          <GuestLodgingSection
            mine={guest.my_lodging}
            lodgings={guest.lodgings}
            weddingDate={guest.wedding_date}
            today={todayIsoDate()}
            currency={guest.currency}
          />
        )}

        {guest.has_registry && (
          <section className="flex flex-col items-center gap-4 rounded-3xl bg-card px-6 py-8 text-center ring-1 ring-border">
            <GiftIcon aria-hidden className="size-6 text-terracotta" strokeWidth={1.3} />
            <div className="flex flex-col gap-1">
              <h2 className="font-serif text-2xl">{t("registry.title")}</h2>
              <p className="text-stone">{t("registry.lead")}</p>
            </div>
            <Link
              href={`/i/${token}/registry`}
              className="inline-flex h-11 items-center rounded-full bg-sage-deep px-6 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
            >
              {t("registry.open")}
            </Link>
          </section>
        )}

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

import { BedDoubleIcon, ExternalLinkIcon, MapPinIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { GUESTS_BOOK_BY_DAYS, SECURED_STATUSES, type LodgingKind } from "@/lib/lodging/catalog";
import type { GuestLodging, MyLodging } from "@/lib/rsvp/schema";
import { addDaysToIsoDate, isoDateToUtc } from "@/lib/weddings/dates";

type GuestLodgingSectionProps = {
  /** Hébergement attribué par les mariés, s'il y en a un. */
  mine: MyLodging | null;
  /** Sans attribution : les adresses où des chambres sont tenues. */
  lodgings: GuestLodging[];
  weddingDate: string | null;
  today: string;
  currency: string;
};

/** Comment l'invité y dort : il réserve sa chambre, partage une maison, ou est reçu chez des proches. */
const STAY: Record<LodgingKind, "book" | "shared" | "hosted"> = {
  hotel: "book",
  guesthouse: "book",
  camping: "book",
  other: "book",
  gite: "shared",
  rental: "shared",
  venue: "shared",
  family: "hosted",
};

/** « Pour votre nuit » : l'hébergement attribué à l'invité, ou les adresses retenues par les mariés. */
export async function GuestLodgingSection({ mine, lodgings, weddingDate, today, currency }: GuestLodgingSectionProps) {
  const [t, tKinds, format] = await Promise.all([
    getTranslations("Rsvp.lodging"),
    getTranslations("Lodging.kinds"),
    getFormatter(),
  ]);
  const date = (iso: string) =>
    format.dateTime(isoDateToUtc(iso), { day: "numeric", month: "long", timeZone: "UTC" });
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });

  const shown = mine ? [mine] : lodgings;
  // Sans date limite propre à un hébergement, un repère général : six semaines avant.
  const fallbackBy = weddingDate ? addDaysToIsoDate(weddingDate, -GUESTS_BOOK_BY_DAYS) : null;
  const showFallback =
    fallbackBy !== null &&
    fallbackBy > today &&
    (mine ? STAY[mine.kind] === "book" : true) &&
    shown.every((lodging) => lodging.deadline === null);

  const card = (lodging: GuestLodging, extra?: ReactNode) => {
    const facts = [
      lodging.travel_minutes !== null && t("travel", { minutes: lodging.travel_minutes }),
      lodging.price_per_night !== null && t("perNight", { price: money(lodging.price_per_night) }),
    ].filter((fact): fact is string => typeof fact === "string");
    return (
      <li key={lodging.id} className="flex flex-col gap-3 rounded-3xl bg-ivory px-6 py-5 ring-1 ring-border">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{tKinds(lodging.kind)}</p>
          <h3 className="font-serif text-xl leading-snug">{lodging.name}</h3>
          {lodging.location && (
            <p className="flex items-center gap-1.5 text-sm text-stone">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              {lodging.location}
            </p>
          )}
        </div>
        {extra}
        {facts.length > 0 && <p className="text-sm text-charcoal">{facts.join(" · ")}</p>}
        {lodging.group_rate && <p className="text-sm text-sage-deep">{t("groupRate")}</p>}
        {lodging.booking_code && (
          <p className="text-sm text-charcoal">
            {t("code")}{" "}
            <span className="rounded-md bg-linen px-1.5 py-0.5 font-medium select-all">{lodging.booking_code}</span>
          </p>
        )}
        {lodging.deadline && lodging.deadline >= today && (
          <p className="text-sm text-terracotta">{t("deadline", { date: date(lodging.deadline) })}</p>
        )}
        {lodging.contact && <p className="text-sm text-stone">{lodging.contact}</p>}
        {lodging.url && (
          <a
            href={lodging.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-sage-deep px-5 text-sm font-medium text-ivory transition-colors hover:bg-[#35402f]"
          >
            {mine && STAY[mine.kind] !== "book" ? t("visit") : t("book")}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
          </a>
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <BedDoubleIcon aria-hidden className="size-6 text-terracotta" strokeWidth={1.3} />
        <h2 className="font-serif text-2xl">{mine ? t("mine.title") : t("title")}</h2>
        <p className="text-stone">{mine ? t(`mine.${STAY[mine.kind]}`, { name: mine.name }) : t("lead")}</p>
        {showFallback && fallbackBy && <p className="text-sm text-charcoal">{t("bookBy", { date: date(fallbackBy) })}</p>}
      </div>

      <ul className="flex flex-col gap-3">
        {mine
          ? card(
              mine,
              <>
                {mine.housemates.length > 0 && (
                  <p className="text-sm text-charcoal">{t("mine.housemates", { names: format.list(mine.housemates) })}</p>
                )}
                {!SECURED_STATUSES.includes(mine.status) && STAY[mine.kind] !== "hosted" && (
                  <p className="text-sm text-stone">{t("mine.pending")}</p>
                )}
              </>,
            )
          : lodgings.map((lodging) => card(lodging))}
      </ul>
    </section>
  );
}

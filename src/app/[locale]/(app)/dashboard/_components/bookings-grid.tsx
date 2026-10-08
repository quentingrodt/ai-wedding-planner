import { ArrowRightIcon, CastleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VENDOR_ICONS } from "@/components/vendors/icons";
import { Link } from "@/i18n/navigation";
import type { BookingState } from "@/lib/dashboard/bookings";
import { cn } from "@/lib/utils";

const SURFACES = {
  booked: "bg-sage-soft",
  leads: "bg-sand/50",
  none: "bg-linen",
} as const;

/** Grille des postes essentiels : réservé (Sauge), en discussion (Sable), à trouver (Lin). */
export async function BookingsGrid({ bookings }: { bookings: BookingState[] }) {
  const [t, tVendors] = await Promise.all([
    getTranslations("Dashboard.vendors"),
    getTranslations("Vendors.categories"),
  ]);
  const booked = bookings.filter((booking) => booking.status === "booked").length;

  return (
    <section
      aria-labelledby="bookings-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.2em] text-sage-deep uppercase">{t("eyebrow")}</p>
          <h2 id="bookings-title" className="text-2xl">
            {t("title")}
          </h2>
        </div>
        <p className="text-sm text-stone tabular-nums">{t("progress", { booked, total: bookings.length })}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {bookings.map((booking) => {
          const Icon = booking.key === "venue" ? CastleIcon : VENDOR_ICONS[booking.key];
          return (
            <li key={booking.key} className="min-w-0">
              <Link
                href={booking.href}
                className={cn(
                  "flex h-full flex-col gap-2 rounded-2xl p-3 transition-shadow hover:shadow-[0_12px_30px_-20px_rgba(43,42,40,0.35)]",
                  SURFACES[booking.status],
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-4", booking.status === "booked" ? "text-sage-deep" : "text-stone")}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm leading-snug wrap-break-word">
                    {booking.key === "venue" ? t("venue") : tVendors(`${booking.key}.label`)}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs",
                      booking.status === "booked" ? "font-medium text-sage-deep" : "text-stone",
                    )}
                  >
                    {booking.status === "booked"
                      ? booking.name
                      : booking.status === "leads"
                        ? t("leads", { count: booking.leads })
                        : t("none")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/vendors"
        className="group mt-auto inline-flex items-center gap-2 self-start text-sm font-medium text-sage-deep"
      >
        {t("seeAll")}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}

import { CalendarDaysIcon, ChevronRightIcon, CircleAlertIcon, MailIcon, WalletIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isLate, type Priority } from "@/lib/dashboard/priorities";
import { cn } from "@/lib/utils";
import { vendorHref } from "@/lib/vendors/catalog";
import { isoDateToUtc, todayIsoDate } from "@/lib/weddings/dates";

type PriorityListProps = {
  priorities: Priority[];
  currency: string;
};

const ICONS = {
  overdueTasks: CircleAlertIcon,
  payment: WalletIcon,
  event: CalendarDaysIcon,
  rsvp: MailIcon,
} as const;

/** « Vos prochaines échéances » : retards, versements, rendez-vous et réponses à relancer. */
export async function PriorityList({ priorities, currency }: PriorityListProps) {
  const [t, tVendors, tCalendar, format] = await Promise.all([
    getTranslations("Dashboard.priorities"),
    getTranslations("Vendors.payments"),
    getTranslations("Calendar.kinds"),
    getFormatter(),
  ]);
  const money = (amount: number) =>
    format.number(amount, { style: "currency", currency, maximumFractionDigits: 0 });
  // Une date plutôt qu'un nombre de jours : « dans 412 jours » ne parle à personne.
  // L'année n'apparaît que lorsqu'elle diffère de l'année en cours.
  const currentYear = todayIsoDate().slice(0, 4);
  const when = (isoDate: string, days: number, time: string | null = null) => {
    const date = format.dateTime(isoDateToUtc(isoDate), {
      day: "numeric",
      month: "long",
      ...(isoDate.slice(0, 4) === currentYear ? {} : { year: "numeric" }),
      timeZone: "UTC",
    });
    return time === null ? t("when", { days, date }) : t("whenTime", { days, date, time });
  };

  const describe = (priority: Priority) => {
    switch (priority.kind) {
      case "overdueTasks":
        return {
          href: "/planning" as const,
          label: t("overdueTasks", { count: priority.count }),
          detail: t("overdueTasksDetail"),
        };
      case "payment": {
        const { payment } = priority;
        return {
          href: vendorHref(payment.vendor.category),
          label: t("payment", { instalment: tVendors(payment.kind), vendor: payment.vendor.name }),
          detail:
            payment.days < 0
              ? t("paymentLate", { amount: money(payment.amount) })
              : t("paymentDue", { amount: money(payment.amount), when: when(payment.due, payment.days) }),
        };
      }
      case "event": {
        const { event, days } = priority;
        return {
          href: "/calendar" as const,
          label: event.title,
          detail: t("eventDetail", {
            kind: tCalendar(event.kind),
            when: when(event.event_date, days, event.start_time),
          }),
        };
      }
      case "rsvp":
        return {
          href: "/guests" as const,
          label: t("rsvp", { count: priority.pending }),
          detail: t("rsvpDetail"),
        };
    }
  };

  return (
    <section
      aria-labelledby="priorities-title"
      className="flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta uppercase">{t("eyebrow")}</p>
        <h2 id="priorities-title" className="text-2xl">
          {t("title")}
        </h2>
      </div>

      {priorities.length === 0 ? (
        <p className="text-stone">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {priorities.map((priority) => {
            const { href, label, detail } = describe(priority);
            const Icon = ICONS[priority.kind];
            const late = isLate(priority);
            return (
              <li key={priority.kind === "payment" ? `payment-${priority.payment.vendor.id}-${priority.payment.kind}` : priority.kind}>
                <Link href={href} className="group flex items-center gap-4 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      late ? "bg-terracotta-soft/60 text-terracotta" : "bg-linen text-sage-deep",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="wrap-break-word transition-colors group-hover:text-sage-deep">{label}</span>
                    <span className={cn("text-sm tabular-nums", late ? "text-terracotta" : "text-stone")}>
                      {detail}
                    </span>
                  </span>
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 shrink-0 text-stone transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

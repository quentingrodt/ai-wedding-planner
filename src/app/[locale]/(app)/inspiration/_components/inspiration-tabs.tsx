"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "favorites", href: "/inspiration" },
  { key: "palette", href: "/inspiration/palette" },
  { key: "moodboard", href: "/inspiration/planche" },
] as const;

/** Onglets de l'espace Inspiration : coups de cœur, identité visuelle, planche. */
export function InspirationTabs() {
  const t = useTranslations("Inspiration.tabs");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-1 rounded-full bg-linen p-1 ring-1 ring-sand/70">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-ivory font-medium text-sage-deep shadow-[0_6px_16px_-10px_rgba(43,42,40,0.45)]"
                    : "text-stone hover:text-charcoal",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

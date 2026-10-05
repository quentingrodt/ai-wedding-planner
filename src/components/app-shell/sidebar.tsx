"use client";

import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HOME_ITEM,
  isActive,
  NAV_GROUPS,
  SETTINGS_ITEM,
  visibleItems,
  type NavItem,
  type ShellProfile,
} from "./nav-config";
import { ProfileCard } from "./profile-card";
import { SignOutForm } from "./sign-out-form";

/** Lien du menu : pastille sauge sur la rubrique active. */
export function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("AppNav.items");
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
        active
          ? "bg-sage-soft font-medium text-sage-deep"
          : "text-charcoal/80 hover:bg-sand/40 hover:text-charcoal",
      )}
    >
      <Icon aria-hidden className={cn("size-4.5", active ? "text-sage-deep" : "text-stone")} />
      {t(item.key)}
    </Link>
  );
}

/** Menu latéral fixe de l'espace connecté (écrans larges). */
export function Sidebar({ profile }: { profile: ShellProfile }) {
  const t = useTranslations("AppNav");
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col print:hidden border-r border-sand/70 bg-linen lg:flex">
      <div className="px-7 pt-8 pb-6">
        <Link href="/dashboard" aria-label={t("home")} className="text-[1.35rem] text-charcoal">
          <Logo />
        </Link>
      </div>

      <nav aria-label={t("label")} className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <NavLink item={HOME_ITEM} pathname={pathname} />
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <p className="px-4 pb-1 text-[0.68rem] font-medium tracking-[0.2em] text-terracotta uppercase">
              {t(`groups.${group.key}`)}
            </p>
            {visibleItems(group.items, profile.canSeeBudget).map((item) => (
              <NavLink key={item.key} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sand/70 px-3 pt-3 pb-5">
        <NavLink item={SETTINGS_ITEM} pathname={pathname} />
        <ProfileCard profile={profile} />
        <SignOutForm />
      </div>
    </aside>
  );
}

"use client";

import { EllipsisIcon, XIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HOME_ITEM,
  isActive,
  NAV_GROUPS,
  SETTINGS_ITEM,
  visibleItems,
  type NavGroup,
  type ShellProfile,
} from "./nav-config";
import { ProfileCard } from "./profile-card";
import { NavLink } from "./sidebar";
import { SignOutForm } from "./sign-out-form";

type Panel = NavGroup["key"] | "more";

const tabClass = (active: boolean) =>
  cn(
    "flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[0.68rem] transition-colors",
    active ? "text-sage-deep" : "text-stone hover:text-charcoal",
  );

function TabIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-sage-soft",
      )}
    >
      <Icon aria-hidden className="size-5" />
    </span>
  );
}

/** Barre d'onglets de l'espace connecté (mobile) : un onglet par chapitre. */
export function MobileNav({ profile }: { profile: ShellProfile }) {
  const t = useTranslations("AppNav");
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel | null>(null);
  const close = () => setPanel(null);

  const homeActive = isActive(pathname, HOME_ITEM.href);
  const group = NAV_GROUPS.find((candidate) => candidate.key === panel);

  return (
    <>
      <nav
        aria-label={t("label")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-sand/70 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          <li className="flex flex-1">
            <Link
              href={HOME_ITEM.href}
              aria-current={homeActive ? "page" : undefined}
              className={tabClass(homeActive)}
            >
              <TabIcon icon={HOME_ITEM.icon} active={homeActive} />
              {t("items.dashboard")}
            </Link>
          </li>
          {NAV_GROUPS.map((candidate) => {
            const active = candidate.items.some((item) => isActive(pathname, item.href));
            return (
              <li key={candidate.key} className="flex flex-1">
                <button
                  type="button"
                  onClick={() => setPanel(candidate.key)}
                  aria-haspopup="dialog"
                  className={tabClass(active)}
                >
                  <TabIcon icon={candidate.icon} active={active} />
                  {t(`tabs.${candidate.key}`)}
                </button>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setPanel("more")}
              aria-haspopup="dialog"
              className={tabClass(isActive(pathname, SETTINGS_ITEM.href))}
            >
              <TabIcon icon={EllipsisIcon} active={isActive(pathname, SETTINGS_ITEM.href)} />
              {t("tabs.more")}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-3xl border-sand bg-ivory px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden"
        >
          <div className="flex items-center justify-between px-4 pt-2 pb-3">
            <SheetTitle className="font-serif text-2xl font-normal">
              {group ? t(`groups.${group.key}`) : t("tabs.more")}
            </SheetTitle>
            <SheetClose
              aria-label={t("close")}
              className="flex size-9 items-center justify-center rounded-full text-stone transition-colors hover:bg-sand/50"
            >
              <XIcon aria-hidden className="size-5" />
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{t("sheetDescription")}</SheetDescription>

          {group ? (
            <div className="flex flex-col gap-1 pb-2">
              {visibleItems(group.items, profile.canSeeBudget).map((item) => (
                <NavLink key={item.key} item={item} pathname={pathname} onNavigate={close} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1 pb-2">
              <ProfileCard profile={profile} />
              <NavLink item={SETTINGS_ITEM} pathname={pathname} onNavigate={close} />
              <SignOutForm />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HOME_ITEM,
  isActive,
  visibleGroups,
  SETTINGS_ITEM,
  visibleItems,
  type NavGroup,
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
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  /** Rubrique d'un chapitre du menu latéral : plus compacte. */
  nested?: boolean;
}) {
  const t = useTranslations("AppNav.items");
  const active = isActive(pathname, item.href, item.exact);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-full text-sm transition-colors",
        nested ? "px-3 py-1.5" : "px-4 py-2.5",
        active
          ? "bg-sage-soft font-medium text-sage-deep"
          : "text-charcoal/80 hover:bg-sand/40 hover:text-charcoal",
      )}
    >
      <Icon aria-hidden className={cn(nested ? "size-4" : "size-4.5", active ? "text-sage-deep" : "text-stone")} />
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

      <nav aria-label={t("label")} className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        <NavLink item={HOME_ITEM} pathname={pathname} />
        <SidebarGroups pathname={pathname} canSeeBudget={profile.canSeeBudget} />
      </nav>

      <div className="flex flex-col gap-1 border-t border-sand/70 px-3 pt-3 pb-5">
        <NavLink item={SETTINGS_ITEM} pathname={pathname} />
        <ProfileCard profile={profile} />
        <SignOutForm />
      </div>
    </aside>
  );
}

// Chapitres dépliés, mémorisés dans ce navigateur (simple confort d'affichage).
const OPEN_GROUPS_KEY = "celeste.sidebar.openGroups";

function readOpenGroups(): string[] | null {
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : null;
  } catch {
    return null;
  }
}

function saveOpenGroups(keys: string[]) {
  try {
    window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(keys));
  } catch {
    // Stockage indisponible (navigation privée) : le menu reste utilisable.
  }
}

/**
 * Les chapitres du menu : un en-tête à déplier, puis ses rubriques.
 * Tous repliés par défaut : le couple ouvre ceux qu'il veut, et chacun reste
 * comme il l'a laissé. Le chapitre de la page ouverte garde une pastille.
 */
function SidebarGroups({ pathname, canSeeBudget }: { pathname: string; canSeeBudget: boolean }) {
  const groups = visibleGroups(canSeeBudget);
  const currentGroup = groups.find((group) =>
    visibleItems(group.items, canSeeBudget).some((item) => isActive(pathname, item.href)),
  )?.key;
  const [open, setOpen] = useState<string[]>([]);

  // Après le rendu serveur : reprend les chapitres laissés ouverts.
  useEffect(() => {
    const saved = readOpenGroups();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage du navigateur après hydratation
    if (saved) setOpen(saved);
  }, []);

  function toggle(key: string) {
    setOpen((current) => {
      const next = current.includes(key) ? current.filter((value) => value !== key) : [...current, key];
      saveOpenGroups(next);
      return next;
    });
  }

  return groups.map((group) => (
    <SidebarGroup
      key={group.key}
      group={group}
      items={visibleItems(group.items, canSeeBudget)}
      pathname={pathname}
      open={open.includes(group.key)}
      current={group.key === currentGroup}
      onToggle={() => toggle(group.key)}
    />
  ));
}

function SidebarGroup({
  group,
  items,
  pathname,
  open,
  current,
  onToggle,
}: {
  group: NavGroup;
  items: NavItem[];
  pathname: string;
  open: boolean;
  /** La page ouverte appartient à ce chapitre. */
  current: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("AppNav");
  const Icon = group.icon;
  const panelId = `nav-group-${group.key}`;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-semibold text-charcoal transition-colors hover:bg-sand/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon aria-hidden className={cn("size-4.5", current ? "text-sage-deep" : "text-terracotta")} />
        <span className="flex-1">{t(`groups.${group.key}`)}</span>
        {/* Replié sur la page en cours : une pastille rappelle où l'on est. */}
        {current && !open && <span aria-hidden className="size-1.5 rounded-full bg-sage-deep" />}
        <ChevronDownIcon
          aria-hidden
          className={cn("size-4 text-stone transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && (
        <div id={panelId} className="mt-0.5 mb-2 ml-6 flex flex-col gap-0.5 border-l border-sand pl-2">
          {items.map((item) => (
            <NavLink key={item.key} item={item} pathname={pathname} nested />
          ))}
        </div>
      )}
    </div>
  );
}

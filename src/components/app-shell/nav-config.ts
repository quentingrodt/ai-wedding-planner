import {
  ArmchairIcon,
  BookHeartIcon,
  CalendarHeartIcon,
  ClockIcon,
  FileTextIcon,
  HouseIcon,
  MailIcon,
  MusicIcon,
  NotebookPenIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

/** Rubriques de l'espace connecté, libellés dans AppNav.items.<key>. */
export type NavItem = {
  key:
    | "dashboard"
    | "inspiration"
    | "budget"
    | "quotes"
    | "guests"
    | "invitations"
    | "seating"
    | "itinerary"
    | "playlist"
    | "settings";
  href:
    | "/dashboard"
    | "/inspiration"
    | "/budget"
    | "/quotes"
    | "/guests"
    | "/invitations"
    | "/seating"
    | "/itinerary"
    | "/playlist"
    | "/settings";
  icon: LucideIcon;
  /** Réservée aux mariés (owner, partner) : masquée pour les témoins. */
  coupleOnly?: boolean;
};

/** Chapitres du menu, libellés dans AppNav.groups.<key>. */
export type NavGroup = { key: "prepare" | "guests" | "day"; icon: LucideIcon; items: NavItem[] };

export const HOME_ITEM: NavItem = { key: "dashboard", href: "/dashboard", icon: HouseIcon };
export const SETTINGS_ITEM: NavItem = { key: "settings", href: "/settings", icon: UsersRoundIcon };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "prepare",
    icon: NotebookPenIcon,
    items: [
      { key: "inspiration", href: "/inspiration", icon: BookHeartIcon },
      { key: "budget", href: "/budget", icon: WalletIcon, coupleOnly: true },
      { key: "quotes", href: "/quotes", icon: FileTextIcon },
    ],
  },
  {
    key: "guests",
    icon: UsersIcon,
    items: [
      { key: "guests", href: "/guests", icon: UsersIcon },
      { key: "invitations", href: "/invitations", icon: MailIcon },
      { key: "seating", href: "/seating", icon: ArmchairIcon },
    ],
  },
  {
    key: "day",
    icon: CalendarHeartIcon,
    items: [
      { key: "itinerary", href: "/itinerary", icon: ClockIcon },
      { key: "playlist", href: "/playlist", icon: MusicIcon },
    ],
  },
];

/** Rubrique active : la page elle-même ou l'une de ses sous-pages. */
export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Profil affiché en bas du menu (prénoms et date du mariage). */
export type ShellProfile = {
  title: string;
  initials: string;
  /** Date du mariage déjà formatée, ou null si elle n'est pas fixée. */
  date: string | null;
  canSeeBudget: boolean;
};

export const visibleItems = (items: NavItem[], canSeeBudget: boolean) =>
  items.filter((item) => canSeeBudget || !item.coupleOnly);

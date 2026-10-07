import {
  ArmchairIcon,
  BedDoubleIcon,
  BookHeartIcon,
  CalendarDaysIcon,
  CalendarHeartIcon,
  CastleIcon,
  ClockIcon,
  FileTextIcon,
  GiftIcon,
  HouseIcon,
  ListChecksIcon,
  MailIcon,
  MusicIcon,
  NotebookPenIcon,
  StoreIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { VENDOR_ICONS } from "@/components/vendors/icons";
import { VENDOR_CATEGORIES, vendorHref, type VendorCategory, type VendorHref } from "@/lib/vendors/catalog";

/** Rubriques de l'espace connecté, libellés dans AppNav.items.<key>. */
export type NavItem = {
  key:
    | "dashboard"
    | "planning"
    | "calendar"
    | "inspiration"
    | "budget"
    | "quotes"
    | "guests"
    | "invitations"
    | "registry"
    | "venues"
    | "accommodation"
    | "seating"
    | "itinerary"
    | "playlist"
    | "settings"
    | "vendors"
    | `vendor_${VendorCategory}`;
  href:
    | "/dashboard"
    | "/planning"
    | "/calendar"
    | "/inspiration"
    | "/budget"
    | "/quotes"
    | "/guests"
    | "/invitations"
    | "/registry"
    | "/venues"
    | "/accommodation"
    | "/seating"
    | "/itinerary"
    | "/playlist"
    | "/settings"
    | "/vendors"
    | VendorHref;
  icon: LucideIcon;
  /** Réservée aux mariés (owner, partner) : masquée pour les témoins. */
  coupleOnly?: boolean;
  /** Active seulement sur sa propre page, pas sur ses sous-pages (vue d'ensemble). */
  exact?: boolean;
};

/** Chapitres du menu, libellés dans AppNav.groups.<key>. */
export type NavGroup = {
  key: "prepare" | "vendors" | "guests" | "day";
  icon: LucideIcon;
  items: NavItem[];
  /** Long chapitre : replié dans le menu latéral tant qu'aucune de ses pages n'est ouverte. */
  collapsible?: boolean;
};

/** Prestataires : la vue d'ensemble, puis une page par catégorie (réservées aux mariés, comme le budget). */
const VENDOR_ITEMS: NavItem[] = [
  { key: "vendors", href: "/vendors", icon: StoreIcon, coupleOnly: true, exact: true },
  ...VENDOR_CATEGORIES.map(
    (category): NavItem => ({
      key: `vendor_${category}`,
      href: vendorHref(category),
      icon: VENDOR_ICONS[category],
      coupleOnly: true,
    }),
  ),
];

export const HOME_ITEM: NavItem = { key: "dashboard", href: "/dashboard", icon: HouseIcon };
export const SETTINGS_ITEM: NavItem = { key: "settings", href: "/settings", icon: UsersRoundIcon };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "prepare",
    icon: NotebookPenIcon,
    items: [
      { key: "planning", href: "/planning", icon: ListChecksIcon },
      { key: "calendar", href: "/calendar", icon: CalendarDaysIcon },
      { key: "inspiration", href: "/inspiration", icon: BookHeartIcon },
      { key: "venues", href: "/venues", icon: CastleIcon, coupleOnly: true },
      { key: "budget", href: "/budget", icon: WalletIcon, coupleOnly: true },
      { key: "quotes", href: "/quotes", icon: FileTextIcon },
    ],
  },
  { key: "vendors", icon: StoreIcon, items: VENDOR_ITEMS, collapsible: true },
  {
    key: "guests",
    icon: UsersIcon,
    items: [
      { key: "guests", href: "/guests", icon: UsersIcon },
      { key: "invitations", href: "/invitations", icon: MailIcon },
      { key: "registry", href: "/registry", icon: GiftIcon },
      { key: "accommodation", href: "/accommodation", icon: BedDoubleIcon },
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
export const isActive = (pathname: string, href: string, exact = false) =>
  pathname === href || (!exact && pathname.startsWith(`${href}/`));

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

/** Chapitres qui gardent au moins une rubrique visible (un témoin ne voit pas les prestataires). */
export const visibleGroups = (canSeeBudget: boolean) =>
  NAV_GROUPS.filter((group) => visibleItems(group.items, canSeeBudget).length > 0);

import type { BudgetCategory } from "@/lib/budget/schema";

/*
 * Prestataires : les catégories du menu, dans l'ordre choisi par les mariés,
 * et ce que chacune relie au reste de l'app (budget, rétroplanning, pages).
 * Libellés et conseils traduits côté UI (Vendors.categories.<clé>).
 */

/** Catégories, alignées sur private.is_vendor_category (000031_vendors.sql). */
export const VENDOR_CATEGORIES = [
  "catering",
  "florist",
  "cake",
  "hair",
  "makeup",
  "beauty",
  "officiant",
  "car",
  "entertainment",
  "guest_gifts",
  "rings",
  "photographer",
  "videographer",
  "bridal_gown",
  "bridesmaids",
  "groom_suit",
  "groomsmen",
  "stationery",
  "website",
  "other",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_STATUSES = ["idea", "contacted", "quote", "meeting", "booked", "declined"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const PRICE_BASES = ["total", "per_guest"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

/** Pages de l'app qui prolongent une catégorie. */
export type VendorLink = "/invitations" | "/playlist" | "/registry" | "/venues";

type CategoryDefinition = {
  /** Poste du budget où se range la dépense (jauge, enveloppe). */
  budget: BudgetCategory;
  /** Prix par défaut d'une nouvelle piste. */
  priceBasis: PriceBasis;
  /** Étapes du rétroplanning cochées quand un prestataire est réservé. */
  tasks: readonly string[];
  /** Rubrique de l'app où poursuivre (faire-part, playlist…). */
  link?: VendorLink;
};

export const VENDOR_CATALOG: Record<VendorCategory, CategoryDefinition> = {
  catering: { budget: "catering", priceBasis: "per_guest", tasks: ["book_catering"], link: "/venues" },
  florist: { budget: "decoration", priceBasis: "total", tasks: ["book_florist"] },
  cake: { budget: "cake", priceBasis: "per_guest", tasks: ["cake_tasting", "book_cake"] },
  hair: { budget: "beauty", priceBasis: "total", tasks: ["book_beauty"] },
  makeup: { budget: "beauty", priceBasis: "total", tasks: ["book_beauty"] },
  beauty: { budget: "beauty", priceBasis: "total", tasks: ["beauty_care"] },
  officiant: { budget: "officiant", priceBasis: "total", tasks: ["book_officiant"] },
  car: { budget: "transport", priceBasis: "total", tasks: ["book_transport"] },
  entertainment: { budget: "music", priceBasis: "total", tasks: ["book_dj"], link: "/playlist" },
  guest_gifts: { budget: "other", priceBasis: "per_guest", tasks: ["guest_gifts", "order_favors"] },
  rings: { budget: "rings", priceBasis: "total", tasks: ["choose_rings"] },
  photographer: { budget: "photography", priceBasis: "total", tasks: ["book_photographer"] },
  videographer: { budget: "photography", priceBasis: "total", tasks: ["book_videographer"] },
  bridal_gown: { budget: "attire", priceBasis: "total", tasks: [] },
  bridesmaids: { budget: "attire", priceBasis: "total", tasks: [] },
  groom_suit: { budget: "attire", priceBasis: "total", tasks: [] },
  groomsmen: { budget: "attire", priceBasis: "total", tasks: [] },
  stationery: { budget: "stationery", priceBasis: "total", tasks: [], link: "/invitations" },
  website: { budget: "stationery", priceBasis: "total", tasks: [], link: "/invitations" },
  other: { budget: "other", priceBasis: "total", tasks: ["book_other_vendors"] },
};

/** Segment d'URL d'une catégorie : guest_gifts → guest-gifts. */
export const vendorSlug = (category: VendorCategory) => category.replaceAll("_", "-");

/** Catégorie d'un segment d'URL, ou null s'il n'existe pas. */
export function categoryFromSlug(slug: string): VendorCategory | null {
  return VENDOR_CATEGORIES.find((category) => vendorSlug(category) === slug) ?? null;
}

export type VendorHref = `/vendors/${string}`;
export const vendorHref = (category: VendorCategory): VendorHref => `/vendors/${vendorSlug(category)}`;

/** Regroupement de la vue d'ensemble. */
export const VENDOR_SECTIONS = [
  { key: "reception", categories: ["catering", "cake", "florist", "entertainment", "car", "guest_gifts"] },
  { key: "memories", categories: ["photographer", "videographer"] },
  {
    key: "attire",
    categories: ["bridal_gown", "bridesmaids", "groom_suit", "groomsmen", "rings"],
  },
  { key: "beauty", categories: ["hair", "makeup", "beauty"] },
  { key: "ceremony", categories: ["officiant", "stationery", "website", "other"] },
] as const satisfies readonly { key: string; categories: readonly VendorCategory[] }[];

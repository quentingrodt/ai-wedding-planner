import type { GuestFamily } from "@/lib/guests/schema";
import { lodgingNeeds, sortLodgings } from "./plan";
import type { Lodging, LodgingGuest } from "./schema";

/*
 * Répartition des hébergements (export PDF) : qui dort où, calculé et trié
 * ici, indépendamment de la mise en page.
 */

export type ListingGuest = {
  id: string;
  /** « Marie Dupont ». */
  displayName: string;
  /** « Dupont, Marie » : entrée de l'index alphabétique. */
  indexName: string;
  isChild: boolean;
};

/** Un foyer (ou un invité seul : name null) dans un hébergement. */
export type ListingHousehold = { name: string | null; guests: ListingGuest[] };

export type ListingLodging = {
  lodging: Lodging;
  households: ListingHousehold[];
  people: number;
  /** Chambres à prévoir pour ces invités (deux adultes par chambre, cf. lodgingNeeds). */
  rooms: number;
};

export type LodgingListing = {
  lodgings: ListingLodging[];
  /** Invités venant de loin sans hébergement attribué. */
  unassigned: ListingHousehold[];
  /** Tous les invités à loger, par nom de famille ; lodgingName null = à loger. */
  index: (ListingGuest & { lodgingName: string | null })[];
  totals: { people: number; assigned: number; unassigned: number; lodgings: number };
};

const clean = (value: string | null) => value?.trim() || null;

function toListingGuest(guest: LodgingGuest): ListingGuest {
  const first = guest.first_name.trim();
  const last = clean(guest.last_name);
  return {
    id: guest.id,
    displayName: last ? `${first} ${last}` : first,
    indexName: last ? `${last}, ${first}` : first,
    isChild: guest.is_child,
  };
}

/** Construit la répartition : hébergements dans l'ordre de la page, foyers puis invités seuls. */
export function buildLodgingListing(
  lodgings: readonly Lodging[],
  guests: readonly LodgingGuest[],
  families: readonly GuestFamily[],
  locale: string,
): LodgingListing {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const byLastName = (a: LodgingGuest, b: LodgingGuest) =>
    collator.compare(clean(a.last_name) ?? a.first_name, clean(b.last_name) ?? b.first_name) ||
    collator.compare(a.first_name, b.first_name);
  const familyName = new Map(families.map((family) => [family.id, family.name]));

  // Invités à loger : venus de loin ou déjà logés, sans ceux qui ont décliné.
  const hosted = guests
    .filter((guest) => guest.status !== "declined" && (guest.needs_lodging || guest.lodging_id !== null))
    .sort(byLastName);

  /** Foyers par ordre alphabétique, puis les invités seuls (un par ligne). */
  const households = (members: readonly LodgingGuest[]): ListingHousehold[] => {
    const byFamily = new Map<string, LodgingGuest[]>();
    const solos: ListingHousehold[] = [];
    for (const guest of members) {
      if (guest.family_id !== null && familyName.has(guest.family_id)) {
        byFamily.set(guest.family_id, [...(byFamily.get(guest.family_id) ?? []), guest]);
      } else {
        solos.push({ name: null, guests: [toListingGuest(guest)] });
      }
    }
    const grouped = [...byFamily.entries()]
      .map(([id, list]) => ({ name: familyName.get(id) ?? null, guests: list.map(toListingGuest) }))
      .sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
    return [...grouped, ...solos];
  };

  const lodgingIds = new Set(lodgings.map((lodging) => lodging.id));
  const listed = sortLodgings(lodgings)
    .map((lodging) => {
      const residents = hosted.filter((guest) => guest.lodging_id === lodging.id);
      const { people, rooms } = lodgingNeeds(residents.map((guest) => ({ ...guest, needs_lodging: true })));
      return { lodging, households: households(residents), people, rooms };
    })
    // Une piste écartée n'apparaît que si des invités y sont encore attribués.
    .filter((entry) => entry.lodging.status !== "declined" || entry.people > 0);

  const names = new Map(lodgings.map((lodging) => [lodging.id, lodging.name]));
  const unassigned = hosted.filter((guest) => guest.lodging_id === null || !lodgingIds.has(guest.lodging_id));

  return {
    lodgings: listed,
    unassigned: households(unassigned),
    index: hosted.map((guest) => ({
      ...toListingGuest(guest),
      lodgingName: guest.lodging_id !== null ? (names.get(guest.lodging_id) ?? null) : null,
    })),
    totals: {
      people: hosted.length,
      assigned: hosted.length - unassigned.length,
      unassigned: unassigned.length,
      lodgings: listed.filter((entry) => entry.people > 0).length,
    },
  };
}

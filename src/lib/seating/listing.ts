import type { SeatedGuest, SeatingTable } from "./schema";

/*
 * Listing du plan de table (export PDF) : calculs et tris en TypeScript,
 * indépendants de la mise en page.
 */

export type ListingGuest = {
  id: string;
  /** « Marie Dupont ». */
  displayName: string;
  /** « Dupont, Marie » : entrée de l'index alphabétique. */
  indexName: string;
  isChild: boolean;
  diet: string | null;
};

export type ListingTable = {
  id: string;
  name: string;
  capacity: number;
  guests: ListingGuest[];
  children: number;
  diets: number;
};

export type SeatingListing = {
  tables: ListingTable[];
  /** Tous les invités confirmés, par nom de famille ; tableName null = à placer. */
  index: (ListingGuest & { tableName: string | null })[];
  unseated: ListingGuest[];
  totals: { guests: number; seated: number; capacity: number; children: number; diets: number };
};

const clean = (value: string | null) => value?.trim() || null;

function toListingGuest(guest: SeatedGuest): ListingGuest {
  const first = guest.first_name.trim();
  const last = clean(guest.last_name);
  return {
    id: guest.id,
    displayName: last ? `${first} ${last}` : first,
    indexName: last ? `${last}, ${first}` : first,
    isChild: guest.is_child,
    diet: clean(guest.dietary_requirements),
  };
}

/** Construit le listing : tables dans l'ordre de création, invités par nom de famille. */
export function buildSeatingListing(
  tables: readonly SeatingTable[],
  guests: readonly SeatedGuest[],
  locale: string,
): SeatingListing {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const byLastName = (a: SeatedGuest, b: SeatedGuest) =>
    collator.compare(clean(a.last_name) ?? a.first_name, clean(b.last_name) ?? b.first_name) ||
    collator.compare(a.first_name, b.first_name);

  const sorted = [...guests].sort(byLastName);
  const tableNames = new Map(tables.map((table) => [table.id, table.name]));

  const listingTables = tables.map((table) => {
    const seated = sorted
      .filter((guest) => guest.seating_table_id === table.id)
      .map(toListingGuest);
    return {
      id: table.id,
      name: table.name,
      capacity: table.capacity,
      guests: seated,
      children: seated.filter((guest) => guest.isChild).length,
      diets: seated.filter((guest) => guest.diet).length,
    };
  });

  // Un invité rattaché à une table supprimée entre-temps est traité comme à placer.
  const index = sorted.map((guest) => ({
    ...toListingGuest(guest),
    tableName: (guest.seating_table_id && tableNames.get(guest.seating_table_id)) || null,
  }));
  const unseated = index.filter((guest) => guest.tableName === null);

  return {
    tables: listingTables,
    index,
    unseated,
    totals: {
      guests: index.length,
      seated: index.length - unseated.length,
      capacity: tables.reduce((sum, table) => sum + table.capacity, 0),
      children: index.filter((guest) => guest.isChild).length,
      diets: index.filter((guest) => guest.diet).length,
    },
  };
}

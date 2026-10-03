import { z } from "zod";

/** Ligne de la table seating_tables, telle que lue par le plan de table. */
export type SeatingTable = {
  id: string;
  name: string;
  capacity: number;
};

/** Invité confirmé, avec sa table éventuelle. */
export type SeatedGuest = {
  id: string;
  first_name: string;
  last_name: string | null;
  is_child: boolean;
  seating_table_id: string | null;
};

/** Limites alignées sur les contraintes CHECK de 000006_seating_tables.sql. */
export const SEATING_LIMITS = {
  name: 80,
  capacity: 100,
} as const;

export const createTableSchema = z.object({
  name: z.string().trim().min(1).max(SEATING_LIMITS.name),
  capacity: z.number().int().min(1).max(SEATING_LIMITS.capacity),
});
export type CreateTableInput = z.input<typeof createTableSchema>;
export type TableField = keyof CreateTableInput;
export type TableFieldError = "required" | "tooLong" | "capacity";

export const deleteTableSchema = z.object({
  tableId: z.uuid(),
});

export const assignGuestSchema = z.object({
  guestId: z.uuid(),
  tableId: z.uuid().nullable(),
});

export type SeatingActionError = "unauthenticated" | "forbidden" | "tableFull" | "generic";

export type CreateTableResult =
  | { ok: true }
  | {
      ok: false;
      error: SeatingActionError | "invalid";
      fieldErrors?: Partial<Record<TableField, TableFieldError>>;
    };

export type SeatingActionResult = { ok: true } | { ok: false; error: SeatingActionError };

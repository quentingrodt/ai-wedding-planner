-- =============================================================================
-- Sprint 5 — Le Plan de Table
-- Migration non destructive : une table, une colonne nullable et un trigger.
-- =============================================================================

create table public.seating_tables (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  capacity   integer not null check (capacity > 0 and capacity <= 100),
  created_at timestamptz not null default now(),
  -- Cible de la clé étrangère composite de guests (même mariage garanti).
  unique (id, wedding_id)
);

create index seating_tables_wedding_id_idx on public.seating_tables (wedding_id, created_at);

alter table public.seating_tables enable row level security;

-- wedding_id et created_at sont figés après création.
revoke update on public.seating_tables from anon, authenticated;
grant update (name, capacity) on public.seating_tables to authenticated;

-- Lecture par tous les membres ; écriture réservée à owner et partner.
create policy "seating_tables: lecture par les membres"
  on public.seating_tables for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "seating_tables: création par owner et partner"
  on public.seating_tables for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "seating_tables: modification par owner et partner"
  on public.seating_tables for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "seating_tables: suppression par owner et partner"
  on public.seating_tables for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- -----------------------------------------------------------------------------
-- guests.seating_table_id
-- -----------------------------------------------------------------------------

alter table public.guests add column seating_table_id uuid;

-- Clé composite : un invité ne peut rejoindre qu'une table de SON mariage
-- (les contrôles de clé étrangère ignorent la RLS). À la suppression de la
-- table, seule seating_table_id repasse à null (syntaxe PostgreSQL 15+).
alter table public.guests
  add constraint guests_seating_table_fkey
  foreign key (seating_table_id, wedding_id)
  references public.seating_tables (id, wedding_id)
  on delete set null (seating_table_id);

create index guests_seating_table_id_idx on public.guests (seating_table_id)
  where seating_table_id is not null;

-- La policy UPDATE existante (owner/partner) couvre la ligne entière, mais les
-- droits colonne de 000005 doivent inclure la nouvelle colonne.
grant update (seating_table_id) on public.guests to authenticated;

-- Capacité garantie en base : verrouille la table visée pour sérialiser les
-- placements simultanés (deux mariés sur deux appareils).
create function private.enforce_seating_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_capacity integer;
  v_seated   integer;
begin
  if new.seating_table_id is null
     or (tg_op = 'UPDATE' and new.seating_table_id is not distinct from old.seating_table_id) then
    return new;
  end if;

  select t.capacity into v_capacity
  from public.seating_tables t
  where t.id = new.seating_table_id
  for no key update;

  select count(*) into v_seated
  from public.guests g
  where g.seating_table_id = new.seating_table_id
    and g.id <> new.id;

  if v_seated >= v_capacity then
    raise exception 'seating table is full' using errcode = 'P0001', hint = 'table_full';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_seating_capacity() from public;

create trigger guests_enforce_seating_capacity
  before insert or update of seating_table_id on public.guests
  for each row execute function private.enforce_seating_capacity();

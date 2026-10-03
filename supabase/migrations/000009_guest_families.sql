-- =============================================================================
-- Les Familles d'invités
-- Migration non destructive : une table et une colonne nullable.
-- =============================================================================

create table public.guest_families (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  -- Libellé libre (ex. « Famille Daussy », « Les amis de Lyon »).
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  -- Cible de la clé étrangère composite de guests (même mariage garanti).
  unique (id, wedding_id)
);

create index guest_families_wedding_id_idx on public.guest_families (wedding_id, created_at);

alter table public.guest_families enable row level security;

-- wedding_id et created_at sont figés après création.
revoke update on public.guest_families from anon, authenticated;
grant update (name) on public.guest_families to authenticated;

-- Lecture par tous les membres ; écriture réservée à owner et partner.
create policy "guest_families: lecture par les membres"
  on public.guest_families for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "guest_families: création par owner et partner"
  on public.guest_families for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "guest_families: modification par owner et partner"
  on public.guest_families for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "guest_families: suppression par owner et partner"
  on public.guest_families for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- -----------------------------------------------------------------------------
-- guests.family_id
-- -----------------------------------------------------------------------------

alter table public.guests add column family_id uuid;

-- Clé composite : un invité ne peut rejoindre qu'une famille de SON mariage
-- (les contrôles de clé étrangère ignorent la RLS). À la suppression de la
-- famille, les invités restent sur la liste : seule family_id repasse à null.
alter table public.guests
  add constraint guests_family_fkey
  foreign key (family_id, wedding_id)
  references public.guest_families (id, wedding_id)
  on delete set null (family_id);

create index guests_family_id_idx on public.guests (family_id)
  where family_id is not null;

-- Les droits colonne de 000005 doivent inclure la nouvelle colonne.
grant update (family_id) on public.guests to authenticated;

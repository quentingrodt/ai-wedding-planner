-- =============================================================================
-- Liste de mariage : réglages, cadeaux et projets de l'urne
-- Migration non destructive : création de trois tables et de leurs policies.
--
-- Céleste n'encaisse aucun argent : les invités participent à l'urne par le
-- moyen choisi par les mariés (lien de cagnotte, virement). Les réservations
-- et participations des invités viendront avec une table dédiée (lot 2).
-- Montants en unités entières de la devise du mariage (weddings.currency_code).
-- =============================================================================

-- Rubriques des cadeaux : pièces de la maison, passions, pièces de transmission.
-- Liste alignée sur REGISTRY_SECTIONS (src/lib/registry/catalog.ts).
create function private.is_registry_section(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in (
    'kitchen', 'table', 'linen', 'appliances', 'bathroom', 'decor', 'outdoor',
    'cooking', 'travel', 'garden', 'wine', 'outdoors', 'culture', 'wellbeing', 'music',
    'heirloom', 'other'
  );
$$;

-- -----------------------------------------------------------------------------
-- registries : une liste par mariage (créée à la fin du parcours d'ouverture).
-- -----------------------------------------------------------------------------
create table public.registries (
  id                  uuid primary key default gen_random_uuid(),
  wedding_id          uuid not null unique references public.weddings (id) on delete cascade,
  -- Mot des mariés à leurs invités : goûts, envies, ce qu'ils préfèrent éviter.
  note                text check (char_length(note) between 1 and 600),
  -- Boîte à idées : les invités peuvent proposer un cadeau (lot 2).
  accepts_suggestions boolean not null default true,
  -- Moyen de participer à l'urne, choisi par les mariés.
  payment_link        text check (payment_link ~ '^https://' and char_length(payment_link) <= 500),
  payment_details     text check (char_length(payment_details) between 1 and 300),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- registry_gifts : les cadeaux de la liste.
-- -----------------------------------------------------------------------------
create table public.registry_gifts (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  section     text not null check (private.is_registry_section(section)),
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) between 1 and 300),
  price       integer check (price between 0 and 1000000),
  quantity    integer not null default 1 check (quantity between 1 and 50),
  url         text check (url ~ '^https?://' and char_length(url) <= 1000),
  image_url   text check (image_url ~ '^https://' and char_length(image_url) <= 1000),
  -- Cadeau d'exception : il pourra être offert à plusieurs.
  is_heirloom boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index registry_gifts_wedding_id_idx on public.registry_gifts (wedding_id, section, position);

-- -----------------------------------------------------------------------------
-- registry_funds : les projets de l'urne (voyage de noces, maison…).
-- -----------------------------------------------------------------------------
create table public.registry_funds (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  kind        text not null check (kind in ('honeymoon', 'home', 'life', 'cause', 'free')),
  title       text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) between 1 and 400),
  goal        integer check (goal between 1 and 1000000),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index registry_funds_wedding_id_idx on public.registry_funds (wedding_id, position);

-- -----------------------------------------------------------------------------
-- Droits : wedding_id et created_at figés ; lecture par les membres,
-- écriture réservée à owner et partner (même règle que guests).
-- -----------------------------------------------------------------------------
revoke update on public.registries, public.registry_gifts, public.registry_funds
  from anon, authenticated;
grant update (note, accepts_suggestions, payment_link, payment_details, updated_at)
  on public.registries to authenticated;
grant update (section, title, description, price, quantity, url, image_url, is_heirloom, position)
  on public.registry_gifts to authenticated;
grant update (kind, title, description, goal, position)
  on public.registry_funds to authenticated;

alter table public.registries enable row level security;
alter table public.registry_gifts enable row level security;
alter table public.registry_funds enable row level security;

create policy "registries: lecture par les membres"
  on public.registries for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "registries: création par owner et partner"
  on public.registries for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "registries: modification par owner et partner"
  on public.registries for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "registry_gifts: lecture par les membres"
  on public.registry_gifts for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "registry_gifts: création par owner et partner"
  on public.registry_gifts for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "registry_gifts: modification par owner et partner"
  on public.registry_gifts for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "registry_gifts: suppression par owner et partner"
  on public.registry_gifts for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "registry_funds: lecture par les membres"
  on public.registry_funds for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "registry_funds: création par owner et partner"
  on public.registry_funds for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "registry_funds: modification par owner et partner"
  on public.registry_funds for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "registry_funds: suppression par owner et partner"
  on public.registry_funds for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

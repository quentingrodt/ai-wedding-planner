-- =============================================================================
-- Hébergement des invités : qui vient de loin, et où le loger.
-- Migration non destructive : une colonne avec défaut sur guests, une table
-- et ses policies.
--
-- Montants en unités entières de la devise du mariage (weddings.currency_code).
-- =============================================================================

-- Invité venant de loin, à loger la nuit du mariage.
alter table public.guests
  add column needs_lodging boolean not null default false;

-- Les privilèges UPDATE sont accordés colonne par colonne (cf. 000005).
grant update (needs_lodging) on public.guests to authenticated;

-- -----------------------------------------------------------------------------
-- guest_lodgings : hôtels, gîtes, locations… repérés ou réservés pour les invités.
-- -----------------------------------------------------------------------------
create table public.guest_lodgings (
  id             uuid primary key default gen_random_uuid(),
  wedding_id     uuid not null references public.weddings (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  -- Liste alignée sur LODGING_KINDS (src/lib/lodging/catalog.ts).
  kind           text not null default 'hotel'
    check (kind in ('hotel', 'guesthouse', 'gite', 'rental', 'camping', 'venue', 'family', 'other')),
  -- Repéré, contacté, chambres posées en option, bloc confirmé, écarté.
  status         text not null default 'idea'
    check (status in ('idea', 'contacted', 'option', 'confirmed', 'declined')),
  location       text check (char_length(location) between 1 and 160),
  -- Trajet jusqu'au lieu de réception, en minutes.
  travel_minutes integer check (travel_minutes between 0 and 1440),
  -- Chambres réservées ou posées en option pour les invités.
  rooms          integer check (rooms between 1 and 500),
  -- Prix d'une chambre pour une nuit.
  price_per_night integer check (price_per_night between 0 and 100000),
  -- Tarif de groupe obtenu, et code ou nom de réservation à donner aux invités.
  group_rate     boolean not null default false,
  booking_code   text check (char_length(booking_code) between 1 and 80),
  -- Date limite : fin de l'option, ou date de libération des chambres non réservées.
  deadline       date,
  url            text check (url ~ '^https?://' and char_length(url) <= 1000),
  contact        text check (char_length(contact) between 1 and 160),
  notes          text check (char_length(notes) between 1 and 600),
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index guest_lodgings_wedding_id_idx on public.guest_lodgings (wedding_id, position);

-- -----------------------------------------------------------------------------
-- Droits : wedding_id et created_at figés ; lecture par les membres,
-- écriture réservée à owner et partner (même règle que guests).
-- -----------------------------------------------------------------------------
revoke update on public.guest_lodgings from anon, authenticated;
grant update (
  name, kind, status, location, travel_minutes, rooms, price_per_night, group_rate,
  booking_code, deadline, url, contact, notes, position, updated_at
) on public.guest_lodgings to authenticated;

alter table public.guest_lodgings enable row level security;

create policy "guest_lodgings: lecture par les membres"
  on public.guest_lodgings for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "guest_lodgings: création par owner et partner"
  on public.guest_lodgings for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "guest_lodgings: modification par owner et partner"
  on public.guest_lodgings for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "guest_lodgings: suppression par owner et partner"
  on public.guest_lodgings for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

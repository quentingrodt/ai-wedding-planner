-- =============================================================================
-- Prestataires : traiteur, fleuriste, photographe… Les pistes de chaque
-- catégorie, comparées jusqu'au choix.
-- Migration non destructive : création d'une fonction de contrôle, d'une table
-- et de ses policies.
--
-- Montants en unités entières de la devise du mariage (weddings.currency_code).
-- Les prix relèvent du budget : lecture et écriture réservées aux mariés,
-- comme budget_items (000010) et venues (000027).
-- =============================================================================

-- Catégories, alignées sur VENDOR_CATEGORIES (src/lib/vendors/catalog.ts).
create function private.is_vendor_category(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in (
    'catering', 'florist', 'cake', 'hair', 'makeup', 'beauty', 'officiant', 'car',
    'entertainment', 'guest_gifts', 'rings', 'photographer', 'videographer',
    'bridal_gown', 'bridesmaids', 'groom_suit', 'groomsmen', 'stationery', 'website', 'other'
  );
$$;

create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  category      text not null check (private.is_vendor_category(category)),
  name          text not null check (char_length(name) between 1 and 120),
  -- Repéré, contacté, devis reçu, rendez-vous (essai, dégustation), réservé, écarté.
  status        text not null default 'idea'
    check (status in ('idea', 'contacted', 'quote', 'meeting', 'booked', 'declined')),
  contact_name  text check (char_length(contact_name) between 1 and 120),
  phone         text check (char_length(phone) between 1 and 40),
  email         text check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+$'),
  url           text check (url ~ '^https?://' and char_length(url) <= 1000),
  location      text check (char_length(location) between 1 and 160),
  -- Prix annoncé : au total, ou par invité (traiteur, dessert, cadeaux).
  price         integer check (price between 0 and 10000000),
  price_basis   text not null default 'total' check (price_basis in ('total', 'per_guest')),
  -- Acompte demandé à la réservation, et s'il est versé.
  deposit       integer check (deposit between 0 and 10000000),
  deposit_paid  boolean not null default false,
  -- Prochain rendez-vous : essai, dégustation, visite de l'atelier.
  meeting_date  date,
  -- Ressenti des mariés, de 1 à 5.
  rating        smallint check (rating between 1 and 5),
  pros          text[] not null default '{}' check (private.is_venue_note_list(pros)),
  cons          text[] not null default '{}' check (private.is_venue_note_list(cons)),
  notes         text check (char_length(notes) between 1 and 1000),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index vendors_wedding_category_idx on public.vendors (wedding_id, category, position);

-- -----------------------------------------------------------------------------
-- Droits : wedding_id, category et created_at figés ; lecture et écriture par
-- owner et partner.
-- -----------------------------------------------------------------------------
revoke update on public.vendors from anon, authenticated;
grant update (
  name, status, contact_name, phone, email, url, location, price, price_basis,
  deposit, deposit_paid, meeting_date, rating, pros, cons, notes, position, updated_at
) on public.vendors to authenticated;

alter table public.vendors enable row level security;

create policy "vendors: lecture par owner et partner"
  on public.vendors for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "vendors: création par owner et partner"
  on public.vendors for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "vendors: modification par owner et partner"
  on public.vendors for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "vendors: suppression par owner et partner"
  on public.vendors for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

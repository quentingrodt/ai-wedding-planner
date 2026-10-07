-- =============================================================================
-- Lieu de réception : les lieux envisagés par les mariés, comparés critère par
-- critère jusqu'au choix final.
-- Migration non destructive : création d'une table, de deux fonctions de
-- contrôle et de ses policies.
--
-- Montants en unités entières de la devise du mariage (weddings.currency_code).
-- Les prix des lieux relèvent du budget : lecture et écriture réservées aux
-- mariés, comme budget_items (cf. 000010).
-- =============================================================================

-- Ambiances d'un lieu : celles du carnet d'inspiration, plus quelques autres.
-- Liste alignée sur VENUE_STYLES (src/lib/venues/catalog.ts).
create function private.is_venue_style(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in ('chateau', 'countryside', 'beach', 'urban', 'barn', 'garden', 'restaurant', 'other');
$$;

-- Avantages et inconvénients : au plus 12 entrées de 1 à 140 caractères.
create function private.is_venue_note_list(value text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(value, 1), 0) <= 12
    and not exists (
      select 1 from unnest(value) as item
      where item is null or char_length(item) not between 1 and 140
    );
$$;

create table public.venues (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references public.weddings (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  -- Avancement : idée, contacté, visité, short-list, réservé, écarté.
  status             text not null default 'idea'
    check (status in ('idea', 'contacted', 'visited', 'shortlisted', 'booked', 'declined')),
  url                text check (url ~ '^https?://' and char_length(url) <= 1000),
  visit_date         date,

  -- Localisation
  location           text check (char_length(location) between 1 and 160),
  -- Trajet depuis la cérémonie (ou la gare la plus proche), en minutes.
  travel_minutes     integer check (travel_minutes between 0 and 1440),
  -- Capacité : nombre maximal d'invités assis.
  capacity           integer check (capacity between 1 and 5000),
  -- Budget : prix total annoncé pour le lieu (location, forfait…).
  price              integer check (price between 0 and 10000000),
  style              text check (private.is_venue_style(style)),
  -- Hébergement des invités : couchages sur place, puis le reste (hôtels, gîtes).
  beds               integer check (beds between 0 and 2000),
  accommodation_note text check (char_length(accommodation_note) between 1 and 300),
  -- Traiteur : inclus, imposé par le lieu ou libre.
  catering           text check (catering in ('included', 'imposed', 'free')),
  -- Restrictions : heure de fin de la musique, puis le reste (bruit, feux…).
  curfew             time,
  restrictions       text check (char_length(restrictions) between 1 and 400),
  -- Flexibilité des dates : notre date est libre, d'autres dates sont proposées, ou complet.
  date_status        text check (date_status in ('available', 'alternatives', 'unavailable')),
  dates_note         text check (char_length(dates_note) between 1 and 300),

  -- Ressenti des mariés, de 1 à 5, critère par critère (null : pas encore noté).
  rating_location      smallint check (rating_location between 1 and 5),
  rating_capacity      smallint check (rating_capacity between 1 and 5),
  rating_budget        smallint check (rating_budget between 1 and 5),
  rating_style         smallint check (rating_style between 1 and 5),
  rating_accommodation smallint check (rating_accommodation between 1 and 5),
  rating_service       smallint check (rating_service between 1 and 5),
  rating_restrictions  smallint check (rating_restrictions between 1 and 5),
  rating_flexibility   smallint check (rating_flexibility between 1 and 5),

  pros               text[] not null default '{}' check (private.is_venue_note_list(pros)),
  cons               text[] not null default '{}' check (private.is_venue_note_list(cons)),
  notes              text check (char_length(notes) between 1 and 1000),
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index venues_wedding_id_idx on public.venues (wedding_id, position);
-- Un seul lieu retenu par mariage.
create unique index venues_one_booked_idx on public.venues (wedding_id) where status = 'booked';

-- -----------------------------------------------------------------------------
-- Droits : wedding_id et created_at figés ; lecture et écriture par owner et partner.
-- -----------------------------------------------------------------------------
revoke update on public.venues from anon, authenticated;
grant update (
  name, status, url, visit_date, location, travel_minutes, capacity, price, style,
  beds, accommodation_note, catering, curfew, restrictions, date_status, dates_note,
  rating_location, rating_capacity, rating_budget, rating_style, rating_accommodation,
  rating_service, rating_restrictions, rating_flexibility,
  pros, cons, notes, position, updated_at
) on public.venues to authenticated;

alter table public.venues enable row level security;

create policy "venues: lecture par owner et partner"
  on public.venues for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "venues: création par owner et partner"
  on public.venues for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "venues: modification par owner et partner"
  on public.venues for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "venues: suppression par owner et partner"
  on public.venues for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

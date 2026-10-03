-- =============================================================================
-- Sprint 6 — Le Conducteur du Jour J
-- Migration non destructive : création d'une table uniquement.
-- =============================================================================

create table public.itinerary_events (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  -- Heure locale du jour J, sans fuseau : le conducteur se lit « à l'horloge murale ».
  start_time  time not null,
  title       text not null check (char_length(title) between 1 and 100),
  location    text check (char_length(location) between 1 and 100),
  description text check (char_length(description) between 1 and 300),
  created_at  timestamptz not null default now()
);

-- Couvre la lecture chronologique (start_time, puis created_at en départage).
create index itinerary_events_wedding_id_idx
  on public.itinerary_events (wedding_id, start_time, created_at);

alter table public.itinerary_events enable row level security;

-- wedding_id et created_at sont figés après création.
revoke update on public.itinerary_events from anon, authenticated;
grant update (start_time, title, location, description)
  on public.itinerary_events to authenticated;

-- Lecture par tous les membres ; écriture réservée à owner et partner.
create policy "itinerary_events: lecture par les membres"
  on public.itinerary_events for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "itinerary_events: création par owner et partner"
  on public.itinerary_events for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "itinerary_events: modification par owner et partner"
  on public.itinerary_events for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "itinerary_events: suppression par owner et partner"
  on public.itinerary_events for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

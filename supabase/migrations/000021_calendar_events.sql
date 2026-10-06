-- =============================================================================
-- Calendrier : rendez-vous prestataires, essayages, dégustations, échéances
-- Migration non destructive : création de table uniquement.
--
-- Les échéances du rétroplanning (tasks.due_date) s'affichent aussi dans le
-- calendrier, sans être recopiées ici.
-- =============================================================================

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  -- Slug traduit côté UI (liste alignée sur CALENDAR_EVENT_KINDS, src/lib/calendar/schema.ts).
  kind        text not null default 'appointment' check (
    kind in ('appointment', 'visit', 'tasting', 'fitting', 'deadline', 'other')
  ),
  title       text not null check (char_length(title) between 1 and 120),
  event_date  date not null,
  -- Heure facultative : un rendez-vous sans heure occupe la journée.
  start_time  time,
  location    text check (char_length(location) between 1 and 120),
  notes       text check (char_length(notes) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index calendar_events_wedding_date_idx
  on public.calendar_events (wedding_id, event_date, start_time);

alter table public.calendar_events enable row level security;

-- wedding_id est figé après création.
revoke update on public.calendar_events from anon, authenticated;
grant update (kind, title, event_date, start_time, location, notes)
  on public.calendar_events to authenticated;

-- Tous les membres (owner, partner, witness) tiennent le calendrier, comme le
-- rétroplanning.
create policy "calendar_events: lecture par les membres"
  on public.calendar_events for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "calendar_events: création par les membres"
  on public.calendar_events for insert to authenticated
  with check (private.has_wedding_role(wedding_id));

create policy "calendar_events: modification par les membres"
  on public.calendar_events for update to authenticated
  using (private.has_wedding_role(wedding_id))
  with check (private.has_wedding_role(wedding_id));

create policy "calendar_events: suppression par les membres"
  on public.calendar_events for delete to authenticated
  using (private.has_wedding_role(wedding_id));

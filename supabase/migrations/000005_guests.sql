-- =============================================================================
-- Sprint 4 — Les Invités (CRM du mariage)
-- Migration non destructive : création d'un type et d'une table uniquement.
-- =============================================================================

create type public.guest_status as enum ('invited', 'confirmed', 'declined', 'tentative');

create table public.guests (
  id                   uuid primary key default gen_random_uuid(),
  wedding_id           uuid not null references public.weddings (id) on delete cascade,
  first_name           text not null check (char_length(first_name) between 1 and 100),
  last_name            text check (char_length(last_name) between 1 and 100),
  status               public.guest_status not null default 'invited',
  -- Préférences alimentaires en texte libre (ex. « végétarien »).
  -- Pas de données médicales : l'UI le rappelle à la saisie.
  dietary_requirements text check (char_length(dietary_requirements) between 1 and 200),
  is_child             boolean not null default false,
  created_at           timestamptz not null default now()
);

create index guests_wedding_id_idx on public.guests (wedding_id, created_at);

alter table public.guests enable row level security;

-- wedding_id et created_at sont figés après création.
revoke update on public.guests from anon, authenticated;
grant update (first_name, last_name, status, dietary_requirements, is_child)
  on public.guests to authenticated;

-- Lecture par tous les membres ; écriture réservée à owner et partner.
create policy "guests: lecture par les membres"
  on public.guests for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "guests: création par owner et partner"
  on public.guests for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "guests: modification par owner et partner"
  on public.guests for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "guests: suppression par owner et partner"
  on public.guests for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

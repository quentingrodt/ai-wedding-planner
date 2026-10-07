-- =============================================================================
-- Hébergement attribué à chaque invité venant de loin.
-- Migration non destructive : une colonne nullable sur guests, une contrainte
-- d'unicité, et get_guest_rsvp remplacée à signature égale (les droits
-- d'exécution de 000015 sont conservés).
-- =============================================================================

-- Cible de la clé étrangère composite (même mariage garanti).
alter table public.guest_lodgings add constraint guest_lodgings_id_wedding_key unique (id, wedding_id);

alter table public.guests add column lodging_id uuid;

-- Un hébergement supprimé libère ses invités : seule lodging_id repasse à
-- null (syntaxe PostgreSQL 15+, comme seating_table_id en 000006).
alter table public.guests
  add constraint guests_lodging_fkey
  foreign key (lodging_id, wedding_id)
  references public.guest_lodgings (id, wedding_id)
  on delete set null (lodging_id);

create index guests_lodging_id_idx on public.guests (lodging_id) where lodging_id is not null;

-- Les privilèges UPDATE sont accordés colonne par colonne (cf. 000005).
grant update (lodging_id) on public.guests to authenticated;

-- -----------------------------------------------------------------------------
-- Lien personnel : l'invité logé reçoit son hébergement, quel qu'en soit le
-- type (y compris « chez des proches », qui le concerne directement), et,
-- pour une maison partagée, le prénom de ceux qui y dorment avec lui.
-- Sans attribution, les adresses en option ou confirmées restent proposées
-- (cf. 000029). Les notes des mariés ne sont jamais partagées.
-- -----------------------------------------------------------------------------
create or replace function public.get_guest_rsvp(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name', g.first_name,
    'last_name', g.last_name,
    'status', g.status,
    'dietary_requirements', g.dietary_requirements,
    'events', g.events,
    'wedding_title', w.title,
    'wedding_date', w.wedding_date,
    'design', i.design,
    'has_registry', exists (select 1 from public.registries r where r.wedding_id = g.wedding_id),
    'my_lodging', case
      when g.status <> 'declined' then (
        select jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'kind', l.kind,
          'status', l.status,
          'location', l.location,
          'travel_minutes', l.travel_minutes,
          'price_per_night', l.price_per_night,
          'group_rate', l.group_rate,
          'booking_code', l.booking_code,
          'deadline', l.deadline,
          'url', l.url,
          'contact', l.contact,
          'housemates', case
            when l.kind in ('gite', 'rental', 'family', 'camping', 'venue') then coalesce((
              select jsonb_agg(o.first_name order by o.first_name)
              from public.guests o
              where o.lodging_id = l.id and o.id <> g.id and o.status <> 'declined'
            ), '[]'::jsonb)
            else '[]'::jsonb
          end
        )
        from public.guest_lodgings l
        where l.id = g.lodging_id and l.status <> 'declined'
      )
    end,
    'lodgings', case
      when g.needs_lodging and g.status <> 'declined' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'kind', l.kind,
          'location', l.location,
          'travel_minutes', l.travel_minutes,
          'price_per_night', l.price_per_night,
          'group_rate', l.group_rate,
          'booking_code', l.booking_code,
          'deadline', l.deadline,
          'url', l.url,
          'contact', l.contact
        ) order by (l.status = 'confirmed') desc, l.position, l.created_at)
        from public.guest_lodgings l
        where l.wedding_id = g.wedding_id
          and l.status in ('option', 'confirmed')
          and l.kind <> 'family'
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'currency', w.currency_code
  )
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.invitations i on i.wedding_id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

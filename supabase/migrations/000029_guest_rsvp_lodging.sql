-- =============================================================================
-- Hébergement sur le lien personnel de l'invité.
-- Migration non destructive : get_guest_rsvp est remplacée à signature égale
-- (les droits d'exécution de 000015 sont conservés).
--
-- Seul un invité marqué « vient de loin » (et qui n'a pas décliné) reçoit les
-- hébergements, et seulement ceux où des chambres sont tenues (en option ou
-- confirmés). Ne sont jamais partagés : les notes internes des mariés, les
-- hébergements « chez des proches » (arrangements privés) et les pistes.
-- =============================================================================

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

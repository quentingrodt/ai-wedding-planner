-- =============================================================================
-- Faire-part en ligne : l'invité voit les étapes auxquelles il est convié
-- Migration non destructive : get_guest_rsvp renvoie aussi guests.events
-- (cf. 000022). Même signature : les droits d'exécution de 000015 sont conservés.
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
    'design', i.design
  )
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.invitations i on i.wedding_id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

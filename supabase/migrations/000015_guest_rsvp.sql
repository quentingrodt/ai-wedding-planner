-- =============================================================================
-- Faire-part en ligne : réponse des invités (RSVP) par lien personnel
-- Migration non destructive : ajout d'une colonne (remplie pour les invités
-- existants) et de deux fonctions.
--
-- Chaque invité reçoit un jeton secret (lien /i/<jeton>). L'invité n'a pas de
-- compte : la RLS lui ferme guests, weddings et invitations. Deux fonctions
-- SECURITY DEFINER, exposées en RPC, font le pont ; la connaissance du jeton
-- vaut autorisation, pour cet invité seulement.
-- =============================================================================

-- Valeur volatile : chaque invité existant reçoit son propre jeton.
alter table public.guests
  add column rsvp_token uuid not null default gen_random_uuid();

alter table public.guests
  add constraint guests_rsvp_token_key unique (rsvp_token);

-- Le jeton n'est jamais modifiable côté client (liste des colonnes
-- modifiables inchangée, cf. 000005 et 000006).

-- -----------------------------------------------------------------------------
-- Lecture : l'invité, le mariage et le faire-part, en un seul objet JSON.
-- null si le jeton est inconnu.
-- -----------------------------------------------------------------------------
create function public.get_guest_rsvp(p_token uuid)
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
    'wedding_title', w.title,
    'wedding_date', w.wedding_date,
    'design', i.design
  )
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.invitations i on i.wedding_id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

-- -----------------------------------------------------------------------------
-- Réponse : présence et régime alimentaire de cet invité uniquement.
-- Renvoie 'saved' | 'invalid' | 'closed' (mariage passé).
-- Un invité qui décline libère sa place au plan de table.
-- -----------------------------------------------------------------------------
create function public.submit_guest_rsvp(
  p_token uuid,
  p_status text,
  p_dietary text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dietary text := nullif(btrim(coalesce(p_dietary, '')), '');
  v_wedding_date date;
begin
  if p_status not in ('confirmed', 'declined', 'tentative') then
    return 'invalid';
  end if;
  if v_dietary is not null and char_length(v_dietary) > 200 then
    return 'invalid';
  end if;

  select w.wedding_date into v_wedding_date
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  where g.rsvp_token = p_token;

  if not found then
    return 'invalid';
  end if;
  if v_wedding_date is not null and v_wedding_date < current_date then
    return 'closed';
  end if;

  update public.guests
  set status = p_status::public.guest_status,
      dietary_requirements = v_dietary,
      seating_table_id = case when p_status = 'declined' then null else seating_table_id end
  where rsvp_token = p_token;

  return 'saved';
end;
$$;

revoke all on function public.get_guest_rsvp(uuid) from public;
revoke all on function public.submit_guest_rsvp(uuid, text, text) from public;
grant execute on function public.get_guest_rsvp(uuid) to anon, authenticated;
grant execute on function public.submit_guest_rsvp(uuid, text, text) to anon, authenticated;

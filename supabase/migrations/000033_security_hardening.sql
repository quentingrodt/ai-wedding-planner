-- =============================================================================
-- Durcissement : le budget total réservé aux mariés, et un garde-fou contre
-- les générations simultanées du plan d'accompagnement (appel payant à l'IA).
-- Migration non destructive : des privilèges de colonne, une colonne nullable
-- et une fonction.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- weddings.total_budget : les témoins lisaient la ligne du mariage entière,
-- budget compris, alors que le budget leur est fermé partout ailleurs (000010).
-- La colonne n'est plus lisible directement ; les mariés la lisent via
-- get_wedding_budget. Les écritures (onboarding, budget) sont inchangées.
-- -----------------------------------------------------------------------------
alter table public.weddings add column plan_requested_at timestamptz;

revoke select on public.weddings from anon, authenticated;
grant select (
  id, title, wedding_date, currency_code, country_code, created_by, created_at,
  guest_count, style_dna, planning_answers, plan_requested_at
) on public.weddings to authenticated;

grant update (plan_requested_at) on public.weddings to authenticated;

create function public.get_wedding_budget(p_wedding_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select w.total_budget
  from public.weddings w
  where w.id = p_wedding_id
    and private.has_wedding_role(w.id, array['owner', 'partner']::public.wedding_role[]);
$$;

revoke all on function public.get_wedding_budget(uuid) from public;
grant execute on function public.get_wedding_budget(uuid) to authenticated;

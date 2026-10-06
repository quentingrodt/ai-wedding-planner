-- =============================================================================
-- Étapes de la journée auxquelles chaque invité est convié
-- Migration non destructive : ajout d'une colonne avec valeur par défaut
-- (les invités existants sont conviés à toute la journée, sans le lendemain).
--
-- Liste fermée, alignée sur GUEST_EVENTS (src/lib/guests/schema.ts) :
--   ceremony  — cérémonie
--   cocktail  — vin d'honneur
--   dinner    — dîner (seule étape concernée par le plan de table)
--   dessert   — dessert et soirée
--   brunch    — lendemain
-- =============================================================================

alter table public.guests
  add column events text[] not null
    default array['ceremony', 'cocktail', 'dinner', 'dessert']
    constraint guests_events_check check (
      cardinality(events) >= 1
      and events <@ array['ceremony', 'cocktail', 'dinner', 'dessert', 'brunch']
    );

comment on column public.guests.events is
  'Étapes auxquelles l''invité est convié (au moins une).';

-- Les droits colonne de 000005 doivent inclure la nouvelle colonne.
grant update (events) on public.guests to authenticated;

-- Un invité absent du dîner n'a pas de place à table. Toutes les lignes
-- existantes reçoivent le dîner par défaut : la contrainte est déjà respectée.
alter table public.guests
  add constraint guests_seating_needs_dinner_check
  check (seating_table_id is null or 'dinner' = any (events));

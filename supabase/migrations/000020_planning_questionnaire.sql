-- =============================================================================
-- Rétroplanning sur mesure : questionnaire d'accompagnement et catégories
-- Migration non destructive : ajout de colonnes et rattrapage des catégories
-- des tâches par défaut existantes. Aucune ligne supprimée.
--
-- Le catalogue des tâches (délais, conditions) vit côté application
-- (src/lib/planning/catalog.ts) ; la base ne garde que le résultat.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- weddings.planning_answers : réponses du questionnaire (null = pas encore
-- rempli). Forme validée côté application (planningAnswersSchema).
-- Modifiable par owner et partner (politique de mise à jour existante).
-- -----------------------------------------------------------------------------
alter table public.weddings
  add column planning_answers jsonb
    check (planning_answers is null or jsonb_typeof(planning_answers) = 'object');

comment on column public.weddings.planning_answers is
  'Réponses du questionnaire de rétroplanning (cérémonie, traiteur, musique…), ou null.';

grant update (planning_answers) on public.weddings to authenticated;

-- -----------------------------------------------------------------------------
-- tasks.category : chapitre du rétroplanning (null pour une tâche libre).
-- tasks.rescheduled : échéance déplacée à la main, préservée au recalcul.
-- -----------------------------------------------------------------------------
alter table public.tasks
  add column category text
    check (category in ('foundations', 'vendors', 'attire', 'guests', 'admin', 'final')),
  add column rescheduled boolean not null default false;

comment on column public.tasks.rescheduled is
  'true si l''échéance a été choisie par le couple : le recalcul du rétroplanning la conserve.';

-- Le recalcul réécrit aussi les dépendances (le catalogue les a affinées).
grant update (category, rescheduled, depends_on_key) on public.tasks to authenticated;

-- Tâches par défaut existantes : catégorie d'après le catalogue.
update public.tasks
set category = case template_key
  when 'set_budget' then 'foundations'
  when 'guest_list' then 'foundations'
  when 'book_venue' then 'foundations'
  when 'book_catering' then 'vendors'
  when 'book_dj' then 'vendors'
  when 'book_photographer' then 'vendors'
  when 'choose_attire' then 'attire'
  when 'send_invitations' then 'guests'
  when 'seating_plan' then 'guests'
end
where category is null
  and template_key in (
    'set_budget', 'guest_list', 'book_venue', 'book_catering', 'book_dj',
    'book_photographer', 'choose_attire', 'send_invitations', 'seating_plan'
  );

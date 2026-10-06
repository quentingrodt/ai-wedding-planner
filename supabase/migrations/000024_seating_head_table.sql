-- =============================================================================
-- Plan de table : la table d'honneur
-- Migration non destructive : ajout d'une colonne avec valeur par défaut et
-- d'un index unique partiel. Aucune ligne supprimée.
-- =============================================================================

alter table public.seating_tables
  add column is_head boolean not null default false;

comment on column public.seating_tables.is_head is
  'Table d''honneur du mariage (une au plus par mariage).';

-- Une seule table d'honneur par mariage.
create unique index seating_tables_one_head_idx
  on public.seating_tables (wedding_id)
  where is_head;

-- Rattrapage : la plus ancienne table nommée « … d'honneur » de chaque mariage
-- devient sa table d'honneur (l'application suggérait ce nom).
update public.seating_tables
set is_head = true
where id in (
  select distinct on (wedding_id) id
  from public.seating_tables
  where name ilike '%honneur%' or name ilike '%head table%'
  order by wedding_id, created_at
);

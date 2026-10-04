-- =============================================================================
-- Rétroplanning vivant : dépendances entre tâches
-- Migration non destructive : ajout d'une colonne nullable et rattachement des
-- tâches par défaut existantes.
--
-- Une tâche peut dépendre d'une autre tâche du même mariage, désignée par sa
-- template_key (ex. le traiteur dépend du lieu). Quand la tâche parente est
-- déplacée, ses dépendantes sont décalées du même nombre de jours (calcul
-- côté application, plafonné à la veille du mariage).
-- =============================================================================

alter table public.tasks
  add column depends_on_key text
    check (depends_on_key ~ '^[a-z][a-z0-9_]{0,63}$');

comment on column public.tasks.depends_on_key is
  'template_key de la tâche dont celle-ci dépend (ex. "book_venue"), ou null.';

-- Les dépendances sont posées à la création : pas de privilège UPDATE dessus
-- (la liste des colonnes modifiables, cf. 000003, reste inchangée).

-- Mariages existants : le traiteur et les faire-part dépendent du lieu.
update public.tasks
set depends_on_key = 'book_venue'
where template_key in ('book_catering', 'book_dj', 'send_invitations')
  and depends_on_key is null;

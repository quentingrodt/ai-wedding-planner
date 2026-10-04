-- =============================================================================
-- Rétroplanning : ajout de la tâche « DJ » aux mariages existants
-- Migration de données, rejouable sans doublon : seuls les mariages qui ont
-- une tâche « lieu » mais pas encore de tâche « DJ » sont concernés.
--
-- Échéance : celle du lieu + 40 jours (écart J-280 → J-240 du rétroplanning
-- par défaut), pour respecter un lieu déjà déplacé ; plafonnée à la veille du
-- mariage. Sans date de mariage ou de lieu : pas d'échéance (J-240 indicatif).
-- Le titre n'est qu'un libellé de secours (l'affichage traduit template_key) :
-- français, langue du marché de lancement.
-- =============================================================================

insert into public.tasks (
  wedding_id, template_key, depends_on_key, title, target_offset_days, due_date
)
select distinct on (venue.wedding_id)
  venue.wedding_id,
  'book_dj',
  'book_venue',
  'Réserver le DJ ou les musiciens',
  case
    when w.wedding_date is null or venue.due_date is null then -240
    else greatest(-1000, least(venue.due_date + 40, w.wedding_date - 1) - w.wedding_date)
  end,
  case
    when w.wedding_date is null or venue.due_date is null then null
    else least(venue.due_date + 40, w.wedding_date - 1)
  end
from public.tasks venue
join public.weddings w on w.id = venue.wedding_id
where venue.template_key = 'book_venue'
  and not exists (
    select 1
    from public.tasks dj
    where dj.wedding_id = venue.wedding_id
      and dj.template_key = 'book_dj'
  )
order by venue.wedding_id, venue.created_at;

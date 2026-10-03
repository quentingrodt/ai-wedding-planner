-- =============================================================================
-- Sprint 3 — Rétroplanning (tasks) et lignes de budget (budget_items)
-- Migration non destructive : création de tables uniquement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tasks : rétroplanning du mariage
-- -----------------------------------------------------------------------------
create type public.task_status as enum ('todo', 'done');

create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  wedding_id         uuid not null references public.weddings (id) on delete cascade,
  -- Clé de traduction des tâches par défaut (ex. "book_venue") ; null pour
  -- une tâche saisie par l'utilisateur, affichée via title.
  template_key       text check (template_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  title              text not null check (char_length(title) between 1 and 200),
  status             public.task_status not null default 'todo',
  -- Décalage par rapport à la date du mariage (ex. -180 = J-6 mois).
  target_offset_days integer not null check (target_offset_days between -1000 and 0),
  due_date           date,
  created_at         timestamptz not null default now()
);

create index tasks_wedding_status_due_idx
  on public.tasks (wedding_id, status, due_date);

alter table public.tasks enable row level security;

-- wedding_id et template_key sont figés après création.
revoke update on public.tasks from anon, authenticated;
grant update (title, status, target_offset_days, due_date)
  on public.tasks to authenticated;

-- Tous les membres (owner, partner, witness) gèrent le rétroplanning.
create policy "tasks: lecture par les membres"
  on public.tasks for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "tasks: création par les membres"
  on public.tasks for insert to authenticated
  with check (private.has_wedding_role(wedding_id));

create policy "tasks: modification par les membres"
  on public.tasks for update to authenticated
  using (private.has_wedding_role(wedding_id))
  with check (private.has_wedding_role(wedding_id));

create policy "tasks: suppression par les membres"
  on public.tasks for delete to authenticated
  using (private.has_wedding_role(wedding_id));

-- -----------------------------------------------------------------------------
-- budget_items : lignes de dépenses (prévu vs réel)
-- Montants en unités entières de la devise du mariage (weddings.currency_code).
-- -----------------------------------------------------------------------------
create table public.budget_items (
  id               uuid primary key default gen_random_uuid(),
  wedding_id       uuid not null references public.weddings (id) on delete cascade,
  -- Slug traduit côté UI (liste alignée sur BUDGET_CATEGORIES, src/lib/budget/schema.ts).
  category         text not null check (
    category in (
      'venue', 'catering', 'photography', 'attire', 'decoration',
      'music', 'stationery', 'contingency', 'other'
    )
  ),
  -- Précision libre saisie par l'utilisateur ; vide pour les lignes par défaut.
  label            text check (char_length(label) <= 200),
  estimated_amount integer not null default 0 check (estimated_amount >= 0),
  actual_amount    integer check (actual_amount >= 0),
  created_at       timestamptz not null default now()
);

create index budget_items_wedding_id_idx on public.budget_items (wedding_id);

alter table public.budget_items enable row level security;

revoke update on public.budget_items from anon, authenticated;
grant update (category, label, estimated_amount, actual_amount)
  on public.budget_items to authenticated;

-- Lecture par tous les membres ; écriture réservée à owner et partner.
create policy "budget_items: lecture par les membres"
  on public.budget_items for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "budget_items: création par owner et partner"
  on public.budget_items for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "budget_items: modification par owner et partner"
  on public.budget_items for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "budget_items: suppression par owner et partner"
  on public.budget_items for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

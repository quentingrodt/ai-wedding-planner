-- =============================================================================
-- Prestataires, suite : échéancier de paiement, détails propres à chaque
-- catégorie, questions posées, voyage de noces, et les « carnets » de chaque
-- catégorie (menu, boissons, mensurations, papeterie…).
-- Migration non destructive : colonnes nullables ou avec défaut, une fonction
-- remplacée (liste élargie) et une table.
-- =============================================================================

-- Le voyage de noces rejoint les catégories (liste alignée sur VENDOR_CATEGORIES).
create or replace function private.is_vendor_category(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value in (
    'catering', 'florist', 'cake', 'hair', 'makeup', 'beauty', 'officiant', 'car',
    'entertainment', 'guest_gifts', 'rings', 'photographer', 'videographer',
    'bridal_gown', 'bridesmaids', 'groom_suit', 'groomsmen', 'stationery', 'website',
    'honeymoon', 'other'
  );
$$;

-- -----------------------------------------------------------------------------
-- vendors : échéancier en trois temps (acompte, deuxième versement, solde).
-- Le montant du solde n'est pas stocké : prix convenu moins les versements.
-- -----------------------------------------------------------------------------
alter table public.vendors
  add column deposit_due     date,
  add column second_payment  integer check (second_payment between 0 and 10000000),
  add column second_due      date,
  add column second_paid     boolean not null default false,
  add column balance_due     date,
  add column balance_paid    boolean not null default false,
  -- Détails propres à la catégorie (modèle, taille, type de soin…) et
  -- questions déjà posées : forme validée côté app (Zod, par catégorie).
  add column details         jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 8192);

grant update (deposit_due, second_payment, second_due, second_paid, balance_due, balance_paid, details)
  on public.vendors to authenticated;

-- -----------------------------------------------------------------------------
-- vendor_plans : le carnet d'une catégorie pour le mariage (menu, boissons,
-- préparatifs beauté, mensurations, papeterie…), un par catégorie.
-- -----------------------------------------------------------------------------
create table public.vendor_plans (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  category   text not null check (private.is_vendor_category(category)),
  data       jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 32768),
  updated_at timestamptz not null default now(),
  primary key (wedding_id, category)
);

revoke update on public.vendor_plans from anon, authenticated;
grant update (data, updated_at) on public.vendor_plans to authenticated;

alter table public.vendor_plans enable row level security;

create policy "vendor_plans: lecture par owner et partner"
  on public.vendor_plans for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "vendor_plans: création par owner et partner"
  on public.vendor_plans for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));
create policy "vendor_plans: modification par owner et partner"
  on public.vendor_plans for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

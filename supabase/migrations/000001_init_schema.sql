-- =============================================================================
-- Sprint 1 — Schéma initial : profiles, weddings, wedding_members
-- RLS stricte sur toutes les tables exposées.
-- =============================================================================

-- Schéma non exposé par l'API REST : fonctions utilitaires (triggers, RLS).
create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- profiles : 1 ligne par utilisateur Supabase Auth
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: lecture de son propre profil"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: modification de son propre profil"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- L'email est la copie de auth.users : seul full_name est modifiable par l'utilisateur.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Création automatique du profil à l'inscription.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- weddings : un projet de mariage
-- -----------------------------------------------------------------------------
create table public.weddings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  wedding_date  date,
  total_budget  numeric(12, 2) check (total_budget >= 0),
  currency_code char(3) not null default 'EUR' check (currency_code ~ '^[A-Z]{3}$'),
  country_code  char(2) check (country_code ~ '^[A-Z]{2}$'),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.weddings enable row level security;

-- created_by est figé après création.
revoke update on public.weddings from anon, authenticated;
grant update (title, wedding_date, total_budget, currency_code, country_code)
  on public.weddings to authenticated;

-- -----------------------------------------------------------------------------
-- wedding_members : mode collaboratif (conjoint, témoins)
-- -----------------------------------------------------------------------------
create type public.wedding_role as enum ('owner', 'partner', 'witness');

create table public.wedding_members (
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.wedding_role not null default 'partner',
  created_at timestamptz not null default now(),
  primary key (wedding_id, user_id)
);

create index wedding_members_user_id_idx on public.wedding_members (user_id);

alter table public.wedding_members enable row level security;

-- Helpers RLS en SECURITY DEFINER : lisent wedding_members sans repasser par
-- ses propres policies (évite la récursion infinie).
create function private.has_wedding_role(
  p_wedding_id uuid,
  p_roles public.wedding_role[] default array['owner', 'partner', 'witness']::public.wedding_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke all on function private.has_wedding_role(uuid, public.wedding_role[]) from public;
grant execute on function private.has_wedding_role(uuid, public.wedding_role[]) to authenticated;

-- Le créateur d'un mariage en devient automatiquement owner.
create function private.add_wedding_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.wedding_members (wedding_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

revoke all on function private.add_wedding_owner() from public;

create trigger on_wedding_created
  after insert on public.weddings
  for each row execute function private.add_wedding_owner();

-- Policies weddings ------------------------------------------------------------
-- created_by = moi : nécessaire pour insert(...).select() (le RETURNING est
-- vérifié avant que le trigger owner n'ait inséré la ligne de membre).
create policy "weddings: lecture par les membres"
  on public.weddings for select to authenticated
  using (
    created_by = (select auth.uid())
    or private.has_wedding_role(id)
  );

create policy "weddings: création à son nom"
  on public.weddings for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "weddings: modification par owner et partner"
  on public.weddings for update to authenticated
  using (private.has_wedding_role(id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(id, array['owner', 'partner']::public.wedding_role[]));

create policy "weddings: suppression par owner"
  on public.weddings for delete to authenticated
  using (private.has_wedding_role(id, array['owner']::public.wedding_role[]));

-- Policies wedding_members ----------------------------------------------------
create policy "wedding_members: lecture par les membres du mariage"
  on public.wedding_members for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "wedding_members: ajout par owner"
  on public.wedding_members for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[]));

create policy "wedding_members: modification par owner"
  on public.wedding_members for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[]));

create policy "wedding_members: retrait par owner ou départ volontaire"
  on public.wedding_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[])
  );

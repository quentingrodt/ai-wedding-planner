-- =============================================================================
-- Sprint 7 — Mode collaboratif : invitations du conjoint et des témoins
-- Migration non destructive : une table, deux fonctions RPC, une policy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- wedding_invites : lien d'invitation à usage unique
-- -----------------------------------------------------------------------------
-- Le token (UUID v4, 122 bits aléatoires) est le secret porté par l'URL.
create table public.wedding_invites (
  token      uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  -- On ne peut pas inviter un second owner.
  role       public.wedding_role not null check (role in ('partner', 'witness')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index wedding_invites_wedding_id_idx on public.wedding_invites (wedding_id);

alter table public.wedding_invites enable row level security;

-- Une invitation ne se modifie pas : on en génère une nouvelle.
revoke update on public.wedding_invites from anon, authenticated;

create policy "wedding_invites: lecture par owner"
  on public.wedding_invites for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[]));

create policy "wedding_invites: création par owner"
  on public.wedding_invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[])
  );

create policy "wedding_invites: révocation par owner"
  on public.wedding_invites for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner']::public.wedding_role[]));

-- -----------------------------------------------------------------------------
-- Côté invité : il n'est pas (encore) membre, la RLS lui ferme wedding_invites,
-- weddings et l'insertion dans wedding_members. Deux fonctions SECURITY DEFINER,
-- exposées en RPC, font le pont ; la connaissance du token vaut autorisation.
-- -----------------------------------------------------------------------------

-- Aperçu avant acceptation : prénoms du couple et rôle proposé.
-- Aucune ligne si le token est inconnu ou expiré.
create function public.get_wedding_invite(p_token uuid)
returns table (wedding_title text, role public.wedding_role)
language sql
stable
security definer
set search_path = ''
as $$
  select w.title, i.role
  from public.wedding_invites i
  join public.weddings w on w.id = i.wedding_id
  where i.token = p_token
    and i.expires_at > now()
    and (select auth.uid()) is not null;
$$;

-- Acceptation atomique : ajout dans wedding_members puis suppression du token.
-- Renvoie 'joined' | 'already_member' | 'invalid' | 'expired' | 'unauthenticated'.
create function public.accept_wedding_invite(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_invite  public.wedding_invites%rowtype;
begin
  if v_user_id is null then
    return 'unauthenticated';
  end if;

  -- Verrou de ligne : deux acceptations simultanées du même lien sont sérialisées.
  select * into v_invite
  from public.wedding_invites
  where token = p_token
  for update;

  if not found then
    return 'invalid';
  end if;

  if v_invite.expires_at <= now() then
    delete from public.wedding_invites where token = p_token;
    return 'expired';
  end if;

  -- Déjà membre (ex. l'owner qui teste son propre lien) : on ne rétrograde
  -- personne et on ne consomme pas le lien, destiné à quelqu'un d'autre.
  if exists (
    select 1 from public.wedding_members
    where wedding_id = v_invite.wedding_id and user_id = v_user_id
  ) then
    return 'already_member';
  end if;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_invite.wedding_id, v_user_id, v_invite.role);

  delete from public.wedding_invites where token = p_token;
  return 'joined';
end;
$$;

revoke all on function public.get_wedding_invite(uuid) from public, anon;
revoke all on function public.accept_wedding_invite(uuid) from public, anon;
grant execute on function public.get_wedding_invite(uuid) to authenticated;
grant execute on function public.accept_wedding_invite(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Équipe : wedding_members est déjà lisible par tous les membres (000001).
-- Pour afficher les prénoms, chacun doit aussi lire le profil de ses co-membres.
-- -----------------------------------------------------------------------------
create function private.shares_wedding_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members mine
    join public.wedding_members theirs on theirs.wedding_id = mine.wedding_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function private.shares_wedding_with(uuid) from public;
grant execute on function private.shares_wedding_with(uuid) to authenticated;

create policy "profiles: lecture des co-membres d'un mariage"
  on public.profiles for select to authenticated
  using (private.shares_wedding_with(id));

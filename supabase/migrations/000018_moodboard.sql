-- =============================================================================
-- Planche de tendances : photos du couple et tableaux Pinterest
-- Migration non destructive : création d'une table, d'une fonction, d'un
-- bucket Storage privé et de leurs policies.
--
-- Convention de chemin (imposée côté serveur, vérifiée ici) :
--   moodboards/{wedding_id}/{uuid}.{jpg|png|webp}
-- Lecture et ajout : tous les membres (les témoins participent à la planche).
-- Modification et suppression : owner, partner, ou l'auteur de l'élément.
-- =============================================================================

create table public.moodboard_items (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  kind          text not null check (kind in ('photo', 'pinterest')),
  -- Photo : chemin dans le bucket « moodboards ».
  file_path     text unique,
  -- Tableau Pinterest public, affiché par le widget officiel.
  pinterest_url text check (
    pinterest_url ~ '^https://www\.pinterest\.com/[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.%-]{1,200}/$'
  ),
  caption       text check (char_length(caption) between 1 and 200),
  category      text check (
    category in ('venue', 'decor', 'flowers', 'attire', 'beauty', 'cake', 'stationery', 'other')
  ),
  created_by    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint moodboard_items_kind_payload check (
    (kind = 'photo' and file_path is not null and pinterest_url is null)
    or (kind = 'pinterest' and pinterest_url is not null and file_path is null)
  ),
  -- Une photo ne peut pointer que vers le dossier de son propre mariage.
  constraint moodboard_items_file_path_in_wedding_folder check (
    file_path is null
    or file_path ~ (
      '^' || wedding_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  ),
  -- Un même tableau n'est lié qu'une fois par mariage.
  constraint moodboard_items_pinterest_unique unique (wedding_id, pinterest_url)
);

create index moodboard_items_wedding_created_idx
  on public.moodboard_items (wedding_id, created_at desc);

alter table public.moodboard_items enable row level security;

-- created_by prend toujours auth.uid() : il n'est ni insérable ni modifiable.
revoke insert, update on public.moodboard_items from anon, authenticated;
grant insert (wedding_id, kind, file_path, pinterest_url, caption, category)
  on public.moodboard_items to authenticated;
grant update (caption, category) on public.moodboard_items to authenticated;

create policy "moodboard: lecture par les membres"
  on public.moodboard_items for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "moodboard: ajout par les membres"
  on public.moodboard_items for insert to authenticated
  with check (private.has_wedding_role(wedding_id) and created_by = (select auth.uid()));

create policy "moodboard: modification par les mariés ou l'auteur"
  on public.moodboard_items for update to authenticated
  using (
    private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[])
    or (created_by = (select auth.uid()) and private.has_wedding_role(wedding_id))
  )
  with check (private.has_wedding_role(wedding_id));

create policy "moodboard: suppression par les mariés ou l'auteur"
  on public.moodboard_items for delete to authenticated
  using (
    private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[])
    or (created_by = (select auth.uid()) and private.has_wedding_role(wedding_id))
  );

-- -----------------------------------------------------------------------------
-- Bucket Storage privé : taille et types MIME vérifiés par Supabase lui-même.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'moodboards',
  'moodboards',
  false,
  10485760, -- 10 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Mariage encodé dans le chemin {wedding_id}/{fichier}, format vérifié avant
-- le cast (même principe que private.can_access_quote_object).
create function private.can_access_wedding_folder(
  p_object_name text,
  p_roles public.wedding_role[] default array['owner', 'partner', 'witness']::public.wedding_role[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[] := storage.foldername(p_object_name);
begin
  if coalesce(array_length(v_folders, 1), 0) <> 1
     or v_folders[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_wedding_role(v_folders[1]::uuid, p_roles);
end;
$$;

revoke all on function private.can_access_wedding_folder(text, public.wedding_role[]) from public;
grant execute on function private.can_access_wedding_folder(text, public.wedding_role[]) to authenticated;

-- Pas de policy UPDATE : une photo déposée n'est jamais écrasée (pas d'upsert).
create policy "moodboards bucket: lecture par les membres"
  on storage.objects for select to authenticated
  using (bucket_id = 'moodboards' and private.can_access_wedding_folder(name));

create policy "moodboards bucket: dépôt par les membres"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'moodboards' and private.can_access_wedding_folder(name));

create policy "moodboards bucket: suppression par les mariés ou l'auteur"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'moodboards'
    and (
      private.can_access_wedding_folder(name, array['owner', 'partner']::public.wedding_role[])
      or (owner_id = (select auth.uid())::text and private.can_access_wedding_folder(name))
    )
  );

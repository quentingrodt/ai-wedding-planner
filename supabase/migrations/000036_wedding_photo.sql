-- =============================================================================
-- Photo du couple : un portrait rond, en tête du tableau de bord et à côté des
-- prénoms dans le menu. Une photo par mariage, dans un bucket privé ; tous les
-- membres la voient, seuls les mariés la changent.
-- Migration non destructive : une colonne nullable, un bucket et ses policies.
-- =============================================================================

alter table public.weddings add column photo_path text;

-- La photo ne peut pointer que vers le dossier de son propre mariage.
alter table public.weddings add constraint weddings_photo_path_in_wedding_folder check (
  photo_path is null
  or photo_path ~ (
    '^' || id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  )
);

-- Lecture par les membres, écriture par les mariés (policy de modification de 000001).
grant select (photo_path) on public.weddings to authenticated;
grant update (photo_path) on public.weddings to authenticated;

-- Le navigateur recadre et compresse la photo (carré JPEG) avant l'envoi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-photos',
  'wedding-photos',
  false,
  2097152, -- 2 Mo
  array['image/jpeg']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "wedding-photos bucket: lecture par les membres"
  on storage.objects for select to authenticated
  using (bucket_id = 'wedding-photos' and private.can_access_wedding_folder(name));

create policy "wedding-photos bucket: dépôt par les mariés"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wedding-photos'
    and private.can_access_wedding_folder(name, array['owner', 'partner']::public.wedding_role[])
  );

create policy "wedding-photos bucket: suppression par les mariés"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'wedding-photos'
    and private.can_access_wedding_folder(name, array['owner', 'partner']::public.wedding_role[])
  );

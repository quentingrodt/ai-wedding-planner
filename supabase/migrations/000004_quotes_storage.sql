-- =============================================================================
-- Sprint 4 — Devis : table quotes, bucket Storage privé "quotes" et RLS.
-- Migration non destructive : création de type, table, fonction, bucket et policies.
--
-- Convention de chemin (imposée côté serveur, vérifiée ici) :
--   quotes/{wedding_id}/{uuid}.{pdf|png|jpg}
-- Lecture : tous les membres. Écriture et suppression : owner et partner.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- quotes : devis téléversés, en attente puis résultat de l'analyse IA
-- -----------------------------------------------------------------------------
create type public.quote_status as enum ('uploaded', 'analyzing', 'processed', 'error');

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  vendor_name text check (char_length(vendor_name) between 1 and 200),
  -- Slug aligné sur budget_items.category (BUDGET_CATEGORIES, src/lib/budget/schema.ts).
  category    text check (
    category in (
      'venue', 'catering', 'photography', 'attire', 'decoration',
      'music', 'stationery', 'contingency', 'other'
    )
  ),
  -- Chemin dans le bucket ; le nom d'origine n'est conservé que pour l'affichage.
  file_path   text not null unique,
  file_name   text not null check (char_length(file_name) between 1 and 255),
  status      public.quote_status not null default 'uploaded',
  -- Montant TTC en unités entières de la devise du mariage (comme budget_items).
  total_ttc   integer check (total_ttc >= 0),
  ai_analysis jsonb,
  created_at  timestamptz not null default now(),
  -- Une ligne ne peut pointer que vers un fichier du dossier de son propre mariage :
  -- empêche de référencer (puis faire analyser) le devis d'un autre mariage.
  constraint quotes_file_path_in_wedding_folder check (
    file_path ~ (
      '^' || wedding_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$'
    )
  )
);

create index quotes_wedding_created_idx on public.quotes (wedding_id, created_at desc);

alter table public.quotes enable row level security;

-- status, total_ttc et ai_analysis sont réservés au pipeline d'analyse côté
-- serveur : ni insérables ni modifiables par l'utilisateur.
revoke insert, update on public.quotes from anon, authenticated;
grant insert (wedding_id, vendor_name, category, file_path, file_name)
  on public.quotes to authenticated;
grant update (vendor_name, category) on public.quotes to authenticated;

create policy "quotes: lecture par les membres"
  on public.quotes for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "quotes: création par owner et partner"
  on public.quotes for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "quotes: modification par owner et partner"
  on public.quotes for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "quotes: suppression par owner et partner"
  on public.quotes for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- -----------------------------------------------------------------------------
-- Bucket Storage privé : taille et types MIME vérifiés par Supabase lui-même.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quotes',
  'quotes',
  false,
  10485760, -- 10 Mo
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Accès à un objet du bucket selon le mariage encodé dans son chemin.
-- Le format UUID est vérifié avant le cast : un dossier arbitraire renvoie
-- false au lieu de faire échouer la requête (l'ordre d'évaluation d'un AND
-- dans une policy n'est pas garanti, d'où la fonction).
create function private.can_access_quote_object(
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
  -- Exactement un niveau de dossier : {wedding_id}/{fichier}.
  if coalesce(array_length(v_folders, 1), 0) <> 1
     or v_folders[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.has_wedding_role(v_folders[1]::uuid, p_roles);
end;
$$;

revoke all on function private.can_access_quote_object(text, public.wedding_role[]) from public;
grant execute on function private.can_access_quote_object(text, public.wedding_role[]) to authenticated;

-- Policies storage.objects ------------------------------------------------------
-- Pas de policy UPDATE : un devis déposé ne peut pas être écrasé (pas d'upsert).
create policy "quotes bucket: lecture par les membres"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quotes'
    and private.can_access_quote_object(name)
  );

create policy "quotes bucket: dépôt par owner et partner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quotes'
    and private.can_access_quote_object(name, array['owner', 'partner']::public.wedding_role[])
  );

create policy "quotes bucket: suppression par owner et partner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quotes'
    and private.can_access_quote_object(name, array['owner', 'partner']::public.wedding_role[])
  );

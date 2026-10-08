-- =============================================================================
-- Playlist du mariage tenue dans Céleste : plus besoin de compte Spotify pour
-- la composer. Chaque morceau (trouvé dans le catalogue Spotify) est rangé par
-- moment de la journée, ou dans « à ne pas passer ». Les mariés ajoutent
-- directement ; un témoin propose, les mariés valident ou écartent.
-- Le compte Spotify lié (000017) ne sert plus qu'à envoyer la liste dans Spotify.
-- Migration non destructive : une table et ses policies.
-- =============================================================================

create table public.playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  -- Identifiant Spotify du morceau (spotify:track:<id>).
  spotify_id  text not null check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  name        text not null check (char_length(name) between 1 and 300),
  artist      text not null check (char_length(artist) between 1 and 500),
  -- Pochette servie par le CDN de Spotify uniquement.
  cover_url   text check (cover_url ~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$'),
  duration_ms integer check (duration_ms > 0),
  section     text not null check (
    section in (
      'ceremony_entrance', 'ceremony', 'ceremony_exit', 'cocktail', 'dinner',
      'first_dance', 'party', 'last_dance', 'do_not_play'
    )
  ),
  -- « suggested » : proposé par un témoin, en attente des mariés.
  status      text not null default 'approved' check (status in ('suggested', 'approved')),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- Un morceau n'apparaît qu'une fois : changer de moment le déplace.
  constraint playlist_tracks_unique_track unique (wedding_id, spotify_id)
);

create index playlist_tracks_wedding_created_idx
  on public.playlist_tracks (wedding_id, created_at);

alter table public.playlist_tracks enable row level security;

revoke insert, update on public.playlist_tracks from anon, authenticated;
grant insert (wedding_id, spotify_id, name, artist, cover_url, duration_ms, section, status)
  on public.playlist_tracks to authenticated;
grant update (section, status) on public.playlist_tracks to authenticated;

create policy "playlist: lecture par les membres"
  on public.playlist_tracks for select to authenticated
  using (private.has_wedding_role(wedding_id));

-- Les mariés ajoutent ce qu'ils veulent ; un témoin ne peut que proposer.
create policy "playlist: ajout par les mariés, proposition par les témoins"
  on public.playlist_tracks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[])
      or (status = 'suggested' and private.has_wedding_role(wedding_id))
    )
  );

create policy "playlist: modification par les mariés"
  on public.playlist_tracks for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- Un témoin peut retirer sa proposition tant qu'elle n'est pas validée.
create policy "playlist: suppression par les mariés ou l'auteur d'une proposition"
  on public.playlist_tracks for delete to authenticated
  using (
    private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[])
    or (
      status = 'suggested'
      and created_by = (select auth.uid())
      and private.has_wedding_role(wedding_id)
    )
  );

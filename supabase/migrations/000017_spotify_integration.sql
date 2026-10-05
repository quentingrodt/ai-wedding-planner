-- =============================================================================
-- Playlist du mariage : liaison avec un compte Spotify
-- Migration non destructive : création d'une table uniquement.
--
-- Les jetons Spotify sont des secrets : la table n'est lisible et modifiable
-- que par le serveur (clé service_role, qui contourne la RLS). Aucun accès
-- pour anon ni authenticated, pas même en lecture.
-- =============================================================================

create table public.spotify_integrations (
  wedding_id              uuid primary key references public.weddings (id) on delete cascade,
  spotify_user_id         text,
  refresh_token           text not null,
  -- Cache du jeton d'accès (1 h chez Spotify) : évite un rafraîchissement par appel.
  access_token            text,
  access_token_expires_at timestamptz,
  playlist_id             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- RLS active sans aucune politique : tout accès client est refusé.
alter table public.spotify_integrations enable row level security;
revoke all on public.spotify_integrations from anon, authenticated;

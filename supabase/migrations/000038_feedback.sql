-- =============================================================================
-- Retours des testeurs : « Un souci ? Une idée ? », envoyé depuis le menu.
-- Chaque retour garde la page d'où il part, pour retrouver le contexte.
-- Lus depuis le tableau de bord Supabase (service role) : l'application ne
-- les affiche à personne, l'auteur ne voit que les siens (limite d'envoi).
-- Migration non destructive : une table et ses policies.
-- =============================================================================

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Mariage affiché au moment de l'envoi ; le retour survit à sa suppression.
  wedding_id  uuid references public.weddings (id) on delete set null,
  kind        text not null check (kind in ('problem', 'idea', 'other')),
  message     text not null check (char_length(btrim(message)) between 1 and 2000),
  -- Chemin de la page, sans domaine ni paramètres (ex. « /guests »).
  page        text check (char_length(page) <= 300 and page ~ '^/'),
  locale      text check (locale ~ '^[a-z]{2}$'),
  -- Navigateur et appareil, pour reproduire un souci d'affichage.
  user_agent  text check (char_length(user_agent) <= 500),
  created_at  timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Un retour envoyé est figé.
revoke insert, update, delete on public.feedback from anon, authenticated;
grant insert (wedding_id, kind, message, page, locale, user_agent)
  on public.feedback to authenticated;

create policy "feedback: lecture de ses propres retours"
  on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));

create policy "feedback: envoi par l'utilisateur connecté"
  on public.feedback for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (wedding_id is null or private.has_wedding_role(wedding_id))
  );

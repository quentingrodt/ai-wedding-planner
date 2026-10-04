-- =============================================================================
-- Plans d'accompagnement générés par l'IA à partir du carnet d'inspiration
-- Migration non destructive : création d'une table uniquement.
--
-- Chaque génération est une nouvelle ligne (historique des régénérations) ;
-- l'application affiche la plus récente. Les montants viennent du calcul
-- TypeScript (allocation), jamais de l'IA ; le texte rédigé est dans plan.
-- =============================================================================

create table public.wedding_plans (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  -- Langue de rédaction (fr, en…).
  locale        text not null check (locale ~ '^[a-z]{2}$'),
  -- Modèle utilisé, pour le suivi des coûts (ex. "claude-haiku-4-5").
  model         text not null check (char_length(model) between 1 and 100),
  -- Entrées figées au moment de la génération : Style DNA et budget réparti.
  style_dna     jsonb not null check (jsonb_typeof(style_dna) = 'object'),
  allocation    jsonb not null check (jsonb_typeof(allocation) = 'object'),
  -- Sortie structurée de l'agent (validée par Zod côté application).
  plan          jsonb not null check (jsonb_typeof(plan) = 'object'),
  input_tokens  integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  created_at    timestamptz not null default now()
);

create index wedding_plans_wedding_created_idx
  on public.wedding_plans (wedding_id, created_at desc);

alter table public.wedding_plans enable row level security;

-- Un plan est figé : ni modification ni suppression côté client.
revoke update, delete on public.wedding_plans from anon, authenticated;

-- Le plan contient le budget : réservé aux mariés, comme budget_items.
create policy "wedding_plans: lecture par owner et partner"
  on public.wedding_plans for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "wedding_plans: création par owner et partner"
  on public.wedding_plans for insert to authenticated
  with check (
    private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[])
    and created_by = (select auth.uid())
  );

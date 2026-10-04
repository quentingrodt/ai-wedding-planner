-- =============================================================================
-- Faire-part : un design par mariage
-- Migration non destructive : création d'une table uniquement.
--
-- design : modèle, palette, polices et textes (validés par Zod côté app).
-- unlocked_at : déblocage des exports d'impression, posé uniquement par le
-- serveur après paiement (aucun privilège d'écriture côté client).
-- =============================================================================

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null unique references public.weddings (id) on delete cascade,
  design      jsonb not null check (jsonb_typeof(design) = 'object'),
  unlocked_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.invitations enable row level security;

-- Le client ne choisit que le mariage et le design ; jamais unlocked_at.
revoke insert, update, delete on public.invitations from anon, authenticated;
grant insert (wedding_id, design) on public.invitations to authenticated;
grant update (design, updated_at) on public.invitations to authenticated;

-- Tous les membres voient le faire-part ; seuls les mariés le modifient.
create policy "invitations: lecture par les membres"
  on public.invitations for select to authenticated
  using (private.has_wedding_role(wedding_id));

create policy "invitations: création par owner et partner"
  on public.invitations for insert to authenticated
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "invitations: modification par owner et partner"
  on public.invitations for update to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]))
  with check (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

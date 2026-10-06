-- =============================================================================
-- Liste de mariage, côté invités : réservations, participations et idées
-- Migration non destructive : deux tables, trois contraintes d'unicité,
-- des fonctions et le remplacement de get_guest_rsvp (même signature).
--
-- Comme pour le RSVP (000015), l'invité n'a pas de compte : la connaissance
-- de son jeton personnel vaut autorisation, pour lui seul, via des fonctions
-- SECURITY DEFINER exposées en RPC. Céleste n'encaisse rien : une
-- participation à l'urne est une promesse, réglée par le moyen des mariés.
-- =============================================================================

-- Cibles des clés étrangères composites (même mariage garanti).
alter table public.guests add constraint guests_id_wedding_key unique (id, wedding_id);
alter table public.registry_gifts add constraint registry_gifts_id_wedding_key unique (id, wedding_id);
alter table public.registry_funds add constraint registry_funds_id_wedding_key unique (id, wedding_id);

-- -----------------------------------------------------------------------------
-- registry_pledges : un cadeau réservé ou une participation annoncée.
-- Une ligne par invité et par cadeau (ou projet) : la modifier remplace.
-- -----------------------------------------------------------------------------
create table public.registry_pledges (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id   uuid not null,
  gift_id    uuid,
  fund_id    uuid,
  -- Cadeau : nombre d'exemplaires réservés.
  quantity   integer check (quantity between 1 and 50),
  -- Participation à l'urne, ou à un cadeau d'exception offert à plusieurs
  -- (unités entières de la devise du mariage ; facultative pour un cadeau).
  amount     integer check (amount between 1 and 1000000),
  message    text check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registry_pledges_one_target check ((gift_id is null) <> (fund_id is null)),
  constraint registry_pledges_fund_amount check (fund_id is null or amount is not null),
  constraint registry_pledges_guest_fkey foreign key (guest_id, wedding_id)
    references public.guests (id, wedding_id) on delete cascade,
  constraint registry_pledges_gift_fkey foreign key (gift_id, wedding_id)
    references public.registry_gifts (id, wedding_id) on delete cascade,
  constraint registry_pledges_fund_fkey foreign key (fund_id, wedding_id)
    references public.registry_funds (id, wedding_id) on delete cascade,
  unique (guest_id, gift_id),
  unique (guest_id, fund_id)
);

create index registry_pledges_wedding_id_idx on public.registry_pledges (wedding_id, created_at);
create index registry_pledges_gift_id_idx on public.registry_pledges (gift_id) where gift_id is not null;
create index registry_pledges_fund_id_idx on public.registry_pledges (fund_id) where fund_id is not null;

-- -----------------------------------------------------------------------------
-- registry_suggestions : la boîte à idées des invités.
-- -----------------------------------------------------------------------------
create table public.registry_suggestions (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id   uuid not null,
  idea       text not null check (char_length(idea) between 1 and 300),
  created_at timestamptz not null default now(),
  constraint registry_suggestions_guest_fkey foreign key (guest_id, wedding_id)
    references public.guests (id, wedding_id) on delete cascade
);

create index registry_suggestions_wedding_id_idx on public.registry_suggestions (wedding_id, created_at);

-- Les invités écrivent par les fonctions ci-dessous ; les membres lisent,
-- les mariés peuvent retirer une ligne. Aucune écriture directe.
revoke insert, update on public.registry_pledges, public.registry_suggestions from anon, authenticated;

alter table public.registry_pledges enable row level security;
alter table public.registry_suggestions enable row level security;

create policy "registry_pledges: lecture par les membres"
  on public.registry_pledges for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "registry_pledges: suppression par owner et partner"
  on public.registry_pledges for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

create policy "registry_suggestions: lecture par les membres"
  on public.registry_suggestions for select to authenticated
  using (private.has_wedding_role(wedding_id));
create policy "registry_suggestions: suppression par owner et partner"
  on public.registry_suggestions for delete to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- -----------------------------------------------------------------------------
-- Lecture : la liste telle que la voit cet invité. Les réservations des autres
-- ne sont visibles que sous forme de totaux (jamais qui a offert quoi).
-- null si le jeton est inconnu ou si les mariés n'ont pas ouvert de liste.
-- -----------------------------------------------------------------------------
create function public.get_guest_registry(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name', g.first_name,
    'wedding_title', w.title,
    'currency', w.currency_code,
    'note', r.note,
    'accepts_suggestions', r.accepts_suggestions,
    'payment_link', r.payment_link,
    'payment_details', r.payment_details,
    'gifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gi.id,
        'section', gi.section,
        'title', gi.title,
        'description', gi.description,
        'price', gi.price,
        'quantity', gi.quantity,
        'url', gi.url,
        'image_url', gi.image_url,
        'is_heirloom', gi.is_heirloom,
        'reserved', coalesce((select sum(p.quantity) from public.registry_pledges p where p.gift_id = gi.id), 0),
        'participants', (select count(*) from public.registry_pledges p where p.gift_id = gi.id),
        'mine_quantity', (select p.quantity from public.registry_pledges p where p.gift_id = gi.id and p.guest_id = g.id),
        'mine_amount', (select p.amount from public.registry_pledges p where p.gift_id = gi.id and p.guest_id = g.id),
        'mine', exists (select 1 from public.registry_pledges p where p.gift_id = gi.id and p.guest_id = g.id)
      ) order by gi.position, gi.created_at)
      from public.registry_gifts gi
      where gi.wedding_id = g.wedding_id
    ), '[]'::jsonb),
    'funds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'kind', f.kind,
        'title', f.title,
        'description', f.description,
        'goal', f.goal,
        'raised', coalesce((select sum(p.amount) from public.registry_pledges p where p.fund_id = f.id), 0),
        'mine_amount', (select p.amount from public.registry_pledges p where p.fund_id = f.id and p.guest_id = g.id)
      ) order by f.position, f.created_at)
      from public.registry_funds f
      where f.wedding_id = g.wedding_id
    ), '[]'::jsonb)
  )
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  join public.registries r on r.wedding_id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

-- -----------------------------------------------------------------------------
-- Réserver un cadeau (ou participer à un cadeau d'exception).
-- Renvoie 'saved' | 'invalid' | 'unavailable' (plus assez d'exemplaires).
-- -----------------------------------------------------------------------------
create function public.reserve_registry_gift(
  p_token uuid,
  p_gift_id uuid,
  p_quantity integer,
  p_amount integer,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_gift public.registry_gifts;
  v_taken integer;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found then
    return 'invalid';
  end if;
  -- Verrou du cadeau : deux invités ne réservent pas le dernier exemplaire en même temps.
  select * into v_gift from public.registry_gifts
  where id = p_gift_id and wedding_id = v_guest.wedding_id
  for update;
  if not found or (v_message is not null and char_length(v_message) > 300) then
    return 'invalid';
  end if;

  if v_gift.is_heirloom then
    -- Offert à plusieurs : chacun participe, sans limite d'exemplaires.
    if p_amount is not null and (p_amount < 1 or p_amount > 1000000) then
      return 'invalid';
    end if;
    insert into public.registry_pledges (wedding_id, guest_id, gift_id, quantity, amount, message)
    values (v_guest.wedding_id, v_guest.id, v_gift.id, null, p_amount, v_message)
    on conflict (guest_id, gift_id) do update
      set amount = excluded.amount, message = excluded.message, updated_at = now();
    return 'saved';
  end if;

  if p_quantity is null or p_quantity < 1 then
    return 'invalid';
  end if;
  select coalesce(sum(quantity), 0) into v_taken
  from public.registry_pledges
  where gift_id = v_gift.id and guest_id <> v_guest.id;
  if v_taken + p_quantity > v_gift.quantity then
    return 'unavailable';
  end if;

  insert into public.registry_pledges (wedding_id, guest_id, gift_id, quantity, amount, message)
  values (v_guest.wedding_id, v_guest.id, v_gift.id, p_quantity, null, v_message)
  on conflict (guest_id, gift_id) do update
    set quantity = excluded.quantity, message = excluded.message, updated_at = now();
  return 'saved';
end;
$$;

-- -----------------------------------------------------------------------------
-- Annoncer une participation à un projet de l'urne.
-- Renvoie 'saved' | 'invalid'.
-- -----------------------------------------------------------------------------
create function public.pledge_registry_fund(
  p_token uuid,
  p_fund_id uuid,
  p_amount integer,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found
    or p_amount is null or p_amount < 1 or p_amount > 1000000
    or (v_message is not null and char_length(v_message) > 300)
    or not exists (
      select 1 from public.registry_funds where id = p_fund_id and wedding_id = v_guest.wedding_id
    ) then
    return 'invalid';
  end if;

  insert into public.registry_pledges (wedding_id, guest_id, fund_id, amount, message)
  values (v_guest.wedding_id, v_guest.id, p_fund_id, p_amount, v_message)
  on conflict (guest_id, fund_id) do update
    set amount = excluded.amount, message = excluded.message, updated_at = now();
  return 'saved';
end;
$$;

-- -----------------------------------------------------------------------------
-- Retirer sa réservation ou sa participation (cadeau ou projet).
-- -----------------------------------------------------------------------------
create function public.withdraw_registry_pledge(p_token uuid, p_target_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.registry_pledges p
    using public.guests g
    where g.rsvp_token = p_token
      and p.guest_id = g.id
      and (p.gift_id = p_target_id or p.fund_id = p_target_id)
    returning p.id
  )
  select case when exists (select 1 from removed) then 'saved' else 'invalid' end;
$$;

-- -----------------------------------------------------------------------------
-- Boîte à idées : si les mariés l'ont ouverte, cinq idées au plus par invité.
-- Renvoie 'saved' | 'invalid' | 'closed' | 'limit'.
-- -----------------------------------------------------------------------------
create function public.suggest_registry_idea(p_token uuid, p_idea text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_idea text := nullif(btrim(coalesce(p_idea, '')), '');
begin
  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found or v_idea is null or char_length(v_idea) > 300 then
    return 'invalid';
  end if;
  if not exists (
    select 1 from public.registries where wedding_id = v_guest.wedding_id and accepts_suggestions
  ) then
    return 'closed';
  end if;
  if (select count(*) from public.registry_suggestions where guest_id = v_guest.id) >= 5 then
    return 'limit';
  end if;
  insert into public.registry_suggestions (wedding_id, guest_id, idea)
  values (v_guest.wedding_id, v_guest.id, v_idea);
  return 'saved';
end;
$$;

-- -----------------------------------------------------------------------------
-- RSVP : la page de l'invité sait désormais si une liste existe.
-- Même signature : les droits d'exécution de 000015 sont conservés.
-- -----------------------------------------------------------------------------
create or replace function public.get_guest_rsvp(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name', g.first_name,
    'last_name', g.last_name,
    'status', g.status,
    'dietary_requirements', g.dietary_requirements,
    'events', g.events,
    'wedding_title', w.title,
    'wedding_date', w.wedding_date,
    'design', i.design,
    'has_registry', exists (select 1 from public.registries r where r.wedding_id = g.wedding_id)
  )
  from public.guests g
  join public.weddings w on w.id = g.wedding_id
  left join public.invitations i on i.wedding_id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

revoke all on function public.get_guest_registry(uuid) from public;
revoke all on function public.reserve_registry_gift(uuid, uuid, integer, integer, text) from public;
revoke all on function public.pledge_registry_fund(uuid, uuid, integer, text) from public;
revoke all on function public.withdraw_registry_pledge(uuid, uuid) from public;
revoke all on function public.suggest_registry_idea(uuid, text) from public;
grant execute on function public.get_guest_registry(uuid) to anon, authenticated;
grant execute on function public.reserve_registry_gift(uuid, uuid, integer, integer, text) to anon, authenticated;
grant execute on function public.pledge_registry_fund(uuid, uuid, integer, text) to anon, authenticated;
grant execute on function public.withdraw_registry_pledge(uuid, uuid) to anon, authenticated;
grant execute on function public.suggest_registry_idea(uuid, text) to anon, authenticated;

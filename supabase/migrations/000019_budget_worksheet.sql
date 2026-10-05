-- =============================================================================
-- Budget en grille : rubriques, postes pré-remplis, notes, qui paie.
-- Migration non destructive : colonnes ajoutées, lignes existantes rangées
-- dans leur rubrique (aucune ligne supprimée, aucun montant modifié).
--
-- Rubriques et postes : src/lib/budget/worksheet.ts (BUDGET_SECTIONS).
-- =============================================================================

alter table public.budget_items
  add column section text check (
    section in (
      'ceremonyReception', 'food', 'attire', 'beauty', 'rings', 'flowers', 'photoVideo',
      'entertainment', 'stationery', 'gifts', 'transport', 'parties', 'honeymoon', 'other'
    )
  ),
  -- Poste de la grille (« venueRental »…) ; null pour un poste ajouté par le couple.
  add column line_key text check (line_key ~ '^[a-z][A-Za-z]{1,40}$'),
  add column notes text check (char_length(notes) between 1 and 500),
  -- Null : le payeur traditionnel du poste s'applique.
  add column payer text check (
    payer in ('couple', 'brideFamily', 'groomFamily', 'shared', 'witnesses')
  );

-- Un poste de la grille n'existe qu'une fois par mariage.
create unique index budget_items_wedding_line_key_idx
  on public.budget_items (wedding_id, line_key)
  where line_key is not null;

-- line_key est fixé à la création : il n'est pas modifiable.
grant update (section, notes, payer) on public.budget_items to authenticated;

-- -----------------------------------------------------------------------------
-- Lignes existantes
-- -----------------------------------------------------------------------------

-- Lignes pré-remplies à l'onboarding (sans libellé) : postes équivalents de la grille.
update public.budget_items set line_key = case category
    when 'venue' then 'venueRental'
    when 'catering' then 'dinnerCatering'
    when 'contingency' then 'contingency'
  end
where label is null and category in ('venue', 'catering', 'contingency')
  and line_key is null;

-- Suggestions ajoutées en un clic (libellé de Céleste) : postes de la grille.
update public.budget_items set
  line_key = case label
    when 'DJ' then 'dj'
    when 'Photographe' then 'photographer'
    when 'Photographer' then 'photographer'
    when 'Fleuriste et décoration' then 'floralDecor'
    when 'Florist and decoration' then 'floralDecor'
    when 'Faire-part et papeterie' then 'invitations'
    when 'Invitations and stationery' then 'invitations'
    when 'Transport des mariés' then 'coupleCar'
    when 'Wedding transport' then 'coupleCar'
    when 'Pièce montée et desserts' then 'weddingCake'
    when 'Wedding cake and desserts' then 'weddingCake'
    when 'Officiant de cérémonie laïque' then 'officiant'
    when 'Celebrant' then 'officiant'
    when 'Voyage de noces' then 'honeymoon'
    when 'Honeymoon' then 'honeymoon'
  end,
  label = null
where line_key is null
  and estimated_amount = 0 and actual_amount is null
  and label in (
    'DJ', 'Photographe', 'Photographer', 'Fleuriste et décoration', 'Florist and decoration',
    'Faire-part et papeterie', 'Invitations and stationery', 'Transport des mariés',
    'Wedding transport', 'Pièce montée et desserts', 'Wedding cake and desserts',
    'Officiant de cérémonie laïque', 'Celebrant', 'Voyage de noces', 'Honeymoon'
  )
  -- Pas de doublon si le poste existe déjà pour ce mariage.
  and not exists (
    select 1 from public.budget_items other
    where other.wedding_id = budget_items.wedding_id
      and other.line_key = case budget_items.label
        when 'DJ' then 'dj'
        when 'Photographe' then 'photographer'
        when 'Photographer' then 'photographer'
        when 'Fleuriste et décoration' then 'floralDecor'
        when 'Florist and decoration' then 'floralDecor'
        when 'Faire-part et papeterie' then 'invitations'
        when 'Invitations and stationery' then 'invitations'
        when 'Transport des mariés' then 'coupleCar'
        when 'Wedding transport' then 'coupleCar'
        when 'Pièce montée et desserts' then 'weddingCake'
        when 'Wedding cake and desserts' then 'weddingCake'
        when 'Officiant de cérémonie laïque' then 'officiant'
        when 'Celebrant' then 'officiant'
        when 'Voyage de noces' then 'honeymoon'
        when 'Honeymoon' then 'honeymoon'
      end
  );

-- Rubrique de chaque ligne : celle de son poste, sinon celle de sa catégorie.
update public.budget_items set section = case
    when line_key in ('venueRental', 'officiant') then 'ceremonyReception'
    when line_key in ('dinnerCatering', 'weddingCake') then 'food'
    when line_key in ('dj') then 'entertainment'
    when line_key in ('photographer') then 'photoVideo'
    when line_key in ('floralDecor') then 'flowers'
    when line_key in ('invitations') then 'stationery'
    when line_key in ('coupleCar') then 'transport'
    when line_key in ('honeymoon') then 'honeymoon'
    when line_key in ('contingency') then 'other'
    else case category
      when 'venue' then 'ceremonyReception'
      when 'officiant' then 'ceremonyReception'
      when 'catering' then 'food'
      when 'cake' then 'food'
      when 'attire' then 'attire'
      when 'beauty' then 'beauty'
      when 'rings' then 'rings'
      when 'decoration' then 'flowers'
      when 'photography' then 'photoVideo'
      when 'music' then 'entertainment'
      when 'stationery' then 'stationery'
      when 'transport' then 'transport'
      when 'honeymoon' then 'honeymoon'
      else 'other'
    end
  end
where section is null;

alter table public.budget_items
  alter column section set default 'other',
  alter column section set not null;

-- -----------------------------------------------------------------------------
-- Notice « qui paie quoi » : montrée une fois par personne.
-- -----------------------------------------------------------------------------
alter table public.profiles add column budget_intro_seen_at timestamptz;
grant update (budget_intro_seen_at) on public.profiles to authenticated;

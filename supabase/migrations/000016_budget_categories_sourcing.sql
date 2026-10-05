-- =============================================================================
-- Budget : catégories élargies, indications de Céleste, sourcing
-- Migration non destructive : contrainte élargie, deux colonnes, reclassement
-- des lignes existantes.
-- =============================================================================

-- 1. Catégories : ces prestataires tombaient faute de mieux dans « other ».
alter table public.budget_items drop constraint budget_items_category_check;
alter table public.budget_items add constraint budget_items_category_check check (
  category in (
    'venue', 'catering', 'cake', 'photography', 'music', 'decoration', 'attire',
    'beauty', 'rings', 'stationery', 'officiant', 'transport', 'honeymoon',
    'contingency', 'other'
  )
);

-- 2. Indication de Céleste : montant de marché affiché à titre indicatif, qui
--    n'entre jamais dans les calculs (seul estimated_amount, saisi par le
--    couple, fait bouger la jauge). Fixée à la création de la ligne.
alter table public.budget_items
  add column suggested_amount integer check (suggested_amount >= 0);

-- 3. Sourcing : comment le couple compte trouver ce prestataire.
alter table public.budget_items
  add column sourcing text not null default 'undecided'
    check (sourcing in ('network', 'celeste', 'undecided'));

grant update (sourcing) on public.budget_items to authenticated;

-- -----------------------------------------------------------------------------
-- Reclassement des lignes existantes
-- -----------------------------------------------------------------------------

-- Prestataires rangés dans « other » faute de catégorie dédiée.
update public.budget_items set category = case
    when label ~* '(alliance|bague|ring)' then 'rings'
    when label ~* '(pi[eè]ce mont[eé]e|g[aâ]teau|cake|dessert)' then 'cake'
    when label ~* '(officiant|c[eé]l[eé]brant|celebrant)' then 'officiant'
    when label ~* '(voyage|lune de miel|honeymoon)' then 'honeymoon'
    when label ~* '(transport|voiture|cal[eè]che|navette|chauffeur|carriage|shuttle)' then 'transport'
    when label ~* '(coiff|maquill|hair|make-up|makeup)' then 'beauty'
    else category
  end
where category = 'other' and label is not null;

-- Montants pré-remplis par Céleste (répartition de l'onboarding, sans nom de
-- prestataire, et suggestions ajoutées en un clic) : ils deviennent des
-- indications et ne pèsent plus sur la jauge.
update public.budget_items
set suggested_amount = estimated_amount,
    estimated_amount = 0
where actual_amount is null
  and (
    (label is null and category in ('venue', 'catering', 'contingency'))
    or label in (
      'DJ', 'Photographe', 'Tenues des mariés', 'Fleuriste et décoration',
      'Faire-part et papeterie', 'Transport des mariés', 'Pièce montée et desserts',
      'Officiant de cérémonie laïque', 'Voyage de noces', 'Alliances',
      'Photographer', 'Wedding outfits', 'Florist and decoration',
      'Invitations and stationery', 'Wedding transport', 'Wedding cake and desserts',
      'Celebrant', 'Honeymoon', 'Wedding rings'
    )
  );

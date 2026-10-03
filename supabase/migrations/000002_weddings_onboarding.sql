-- =============================================================================
-- Sprint 2 — Onboarding : nombre d'invités et "Style DNA" du mariage
-- Migration non destructive (ajout de colonnes nullables / avec défaut).
-- =============================================================================

alter table public.weddings
  add column guest_count integer
    check (guest_count between 1 and 2000),
  -- Forme validée côté app (Zod, champ "version") : extensible sans migration
  -- (palette, mots-clés…). La base garantit seulement un objet JSON.
  add column style_dna jsonb not null default '{}'::jsonb
    check (jsonb_typeof(style_dna) = 'object');

comment on column public.weddings.title is
  'Prénoms du couple, ex. "Camille & Thomas".';
comment on column public.weddings.style_dna is
  'ADN stylistique du mariage, ex. {"version": 1, "ambiance": "chateau"}.';

-- Les privilèges UPDATE sont accordés colonne par colonne (cf. 000001).
grant update (guest_count, style_dna) on public.weddings to authenticated;

-- =============================================================================
-- Retrait de la rubrique « Devis » (dépôt et analyse de devis), abandonnée :
-- les devis se suivent désormais dans les fiches des prestataires (000031).
-- Migration destructive, appliquée alors que la table et le bucket étaient
-- vides (0 ligne, 0 fichier). Le bucket « quotes » lui-même est supprimé par
-- l'API Storage : Supabase interdit d'effacer ses tables en SQL.
-- =============================================================================

drop policy if exists "quotes bucket: lecture par les membres" on storage.objects;
drop policy if exists "quotes bucket: dépôt par owner et partner" on storage.objects;
drop policy if exists "quotes bucket: suppression par owner et partner" on storage.objects;

drop function if exists private.can_access_quote_object(text, public.wedding_role[]);

drop table if exists public.quotes;
drop type if exists public.quote_status;

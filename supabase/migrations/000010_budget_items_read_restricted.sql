-- =============================================================================
-- Budget réservé aux mariés
-- Les témoins ne lisent plus les lignes de budget : la lecture est alignée sur
-- l'écriture (owner et partner). Migration non destructive : une policy remplacée.
-- =============================================================================

drop policy "budget_items: lecture par les membres" on public.budget_items;

create policy "budget_items: lecture par owner et partner"
  on public.budget_items for select to authenticated
  using (private.has_wedding_role(wedding_id, array['owner', 'partner']::public.wedding_role[]));

-- =============================================================================
-- get_wedding_budget (000033) : Supabase accorde par défaut l'exécution des
-- nouvelles fonctions au rôle anon, ce que « revoke ... from public » ne retire
-- pas. La fonction ne renvoyait rien à un visiteur (contrôle du rôle), mais elle
-- n'a pas à lui être ouverte, comme get_wedding_invite (000008).
-- =============================================================================

revoke all on function public.get_wedding_budget(uuid) from anon;

-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — le contrôle de gestion lit les chiffres de tous les magasins (03/11/2026). Réexécutable.
-- Décision de Joseph (fusion avec l'app réseau, question 5) : le contrôle de gestion voit les paramètres ET les chiffres
-- de tous les magasins. Jusqu'ici (0021), il ne voyait que les paramètres. Il lit désormais les mêmes magasins que le
-- Directeur (pilotage.mes_magasins) ; il n'écrit toujours dans aucune table d'un magasin : chaque règle d'écriture
-- exige le rôle Directeur, RR, Coach ou franchisé, qu'il n'a pas.
-- Rejouer 0001 seule remet l'ancienne fonction, plus stricte : aucun accès rouvert.
-- Suppose 0001_socle_pilotage.sql et 0021_parametrage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pilotage.mes_magasins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN public.mon_role() = 'directeur'
      OR (public.mon_role() NOT IN ('coach', 'rr', 'franchise') AND EXISTS (SELECT 1 FROM pilotage.controle_gestion c WHERE c.user_id = auth.uid()))
    THEN coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM (
      SELECT p.store_name AS m FROM public.perimetre_equipe p
      UNION SELECT b.store_name FROM pilotage.budgets b) x), '{}'::text[])
    WHEN public.mon_role() IN ('coach', 'rr') THEN public.magasins_visibles()
    WHEN public.mon_role() = 'franchise' THEN public.mes_magasins()
    ELSE '{}'::text[] END
$$;
REVOKE ALL ON FUNCTION pilotage.mes_magasins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.mes_magasins() TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0029', 'controle_gestion_chiffres')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

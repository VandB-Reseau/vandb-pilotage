-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — accès « Direction » en lecture (Joseph, 24/11/2026, lot 2 après le carnet du magasin). Réexécutable.
-- Un compte au rôle direction (ouvert par le Directeur dans l'app réseau, migration réseau 0054) lit les budgets,
-- le réel et les repères de tous les magasins, comme le Directeur ; il n'écrit rien dans le schéma pilotage :
-- aucune règle d'écriture ne le nomme, et les fonctions qui écrivent ne sont pas touchées.
-- Les règles existantes ne sont pas rouvertes : on ajoute des lectures réservées au rôle direction.
-- Indépendante de la migration réseau 0054 (lit seulement public.mon_role()).
-- ════════════════════════════════════════════════════════════════

-- ── 1) Magasins lisibles : tous, pour la Direction (comme le Directeur et le contrôle de gestion)
CREATE OR REPLACE FUNCTION pilotage.mes_magasins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN public.mon_role() IN ('directeur', 'direction')
      OR (public.mon_role() NOT IN ('coach', 'rr', 'franchise') AND EXISTS (SELECT 1 FROM pilotage.controle_gestion c WHERE c.user_id = auth.uid()))
    THEN coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM (
      SELECT p.store_name AS m FROM public.perimetre_equipe p
      UNION SELECT b.store_name FROM pilotage.budgets b) x), '{}'::text[])
    WHEN public.mon_role() IN ('coach', 'rr') THEN public.magasins_visibles()
    WHEN public.mon_role() = 'franchise' THEN public.mes_magasins()
    ELSE '{}'::text[] END
$$;

-- ── 2) Référentiels des budgets (années, cibles, groupes, codes de caisse, paramètres) : lecture seule
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['annees', 'cibles_groupe', 'cibles_reseau', 'codes_caisse', 'groupe_magasins', 'groupes', 'parametres_reseau'] LOOP
    IF to_regclass('pilotage.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "direction_lecture" ON pilotage.%I', t);
      EXECUTE format('CREATE POLICY "direction_lecture" ON pilotage.%I FOR SELECT TO authenticated USING ((SELECT public.mon_role()) = ''direction'')', t);
    END IF;
  END LOOP;
END $$;

-- ── 3) Fonctions de lecture des budgets et du réel : la Direction y lit comme le Directeur
DO $$
DECLARE f text; d text; n text;
BEGIN
  FOREACH f IN ARRAY ARRAY['budgets_du_compte', 'reel_du_compte'] LOOP
    FOR d IN SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE p.pronamespace = 'pilotage'::regnamespace AND p.proname = f LOOP
      n := replace(d, 'IN (''directeur'', ''rr'', ''coach'', ''franchise'')', 'IN (''directeur'', ''rr'', ''coach'', ''franchise'', ''direction'')');
      n := replace(n, 'public.mon_role() IN (''directeur'', ''rr'')', 'public.mon_role() IN (''directeur'', ''rr'', ''direction'')');
      n := replace(n, 'public.mon_role() = ''directeur''', 'public.mon_role() IN (''directeur'', ''direction'')');
      n := replace(n, 'public.est_directeur()', 'public.mon_role() IN (''directeur'', ''direction'')');
      IF n <> d THEN EXECUTE n; END IF;
    END LOOP;
  END LOOP;
END $$;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0038', 'acces_direction')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

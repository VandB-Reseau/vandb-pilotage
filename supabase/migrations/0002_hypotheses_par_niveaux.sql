-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — hypothèses du budget par niveaux (26/10/2026). Réexécutable.
-- Décision de Joseph : réseau, puis groupe de magasins, puis magasin.
--
-- 1) Groupes libres de magasins (centre-ville, zone commerciale, intégrés…) : un magasin est dans un groupe au plus.
-- 2) Cibles de l'année (évolutions, marges visées, hausse des salaires, inflation des frais) : pour le réseau
--    et par groupe. Écrites par le Directeur, lues par l'équipe ; le franchisé les reçoit avec son budget.
-- 3) Budget : base du magasin (importée de son prévisionnel Excel par le Directeur, jamais modifiée par le
--    franchisé) et ajustements du magasin (le franchisé peut s'écarter des cibles : le budget passe en discussion).
-- 4) budgets_du_compte(année) : budgets, cibles du réseau et des groupes utiles au compte connecté.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Groupes
CREATE TABLE IF NOT EXISTS pilotage.groupes (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom     text NOT NULL UNIQUE CHECK (btrim(nom) <> ''),
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pilotage.groupe_magasins (
  store_name text PRIMARY KEY CHECK (store_name <> ''),
  groupe_id  bigint NOT NULL REFERENCES pilotage.groupes (id) ON DELETE CASCADE
);

-- ── 2) Cibles
CREATE TABLE IF NOT EXISTS pilotage.cibles_reseau (
  annee   integer PRIMARY KEY CHECK (annee BETWEEN 2020 AND 2100),
  valeur  jsonb NOT NULL CHECK (jsonb_typeof(valeur) = 'object'),
  maj_le  timestamptz NOT NULL DEFAULT now(),
  maj_par uuid DEFAULT auth.uid()
);
CREATE TABLE IF NOT EXISTS pilotage.cibles_groupe (
  groupe_id bigint NOT NULL REFERENCES pilotage.groupes (id) ON DELETE CASCADE,
  annee     integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  valeur    jsonb NOT NULL CHECK (jsonb_typeof(valeur) = 'object'),
  maj_le    timestamptz NOT NULL DEFAULT now(),
  maj_par   uuid DEFAULT auth.uid(),
  PRIMARY KEY (groupe_id, annee)
);

-- ── 3) Base et ajustements du budget
ALTER TABLE pilotage.budgets ADD COLUMN IF NOT EXISTS base jsonb CHECK (base IS NULL OR jsonb_typeof(base) = 'object');
ALTER TABLE pilotage.budgets ADD COLUMN IF NOT EXISTS ajustements jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ajustements) = 'object');

-- La base appartient au siège. Garde distincte de garde_budget : rejouer 0001 seule ne la retire pas.
CREATE OR REPLACE FUNCTION pilotage.garde_base() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() AND NEW.base IS DISTINCT FROM OLD.base THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS garde_base ON pilotage.budgets;
CREATE TRIGGER garde_base BEFORE UPDATE ON pilotage.budgets FOR EACH ROW EXECUTE FUNCTION pilotage.garde_base();
REVOKE ALL ON FUNCTION pilotage.garde_base() FROM PUBLIC, anon, authenticated;

-- ── Règles d'accès des nouvelles tables : on repart de zéro à chaque passage
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['groupes', 'groupe_magasins', 'cibles_reseau', 'cibles_groupe'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('CREATE POLICY "equipe_lecture" ON pilotage.%I FOR SELECT TO authenticated USING ((SELECT public.mon_role()) IN (''directeur'', ''rr'', ''coach''))', t);
    EXECUTE format('CREATE POLICY "directeur_ecriture" ON pilotage.%I FOR ALL TO authenticated USING ((SELECT public.est_directeur())) WITH CHECK ((SELECT public.est_directeur()))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.%I TO authenticated', t);
  END LOOP;
END $$;

-- ── 4) Budgets du compte connecté, avec les cibles qui s'y appliquent
CREATE OR REPLACE FUNCTION pilotage.budgets_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mes AS (SELECT unnest(pilotage.mes_magasins()) AS m)
  SELECT jsonb_build_object(
    'magasins', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'magasin', mes.m, 'statut', b.statut, 'base', b.base, 'ajustements', b.ajustements, 'hypotheses', b.hypotheses,
        'maj_le', b.maj_le, 'valide_le', b.valide_le, 'groupe_id', g.groupe_id) ORDER BY mes.m)
      FROM mes
      LEFT JOIN pilotage.budgets b ON b.store_name = mes.m AND b.annee = p_annee
      LEFT JOIN pilotage.groupe_magasins g ON g.store_name = mes.m), '[]'::jsonb),
    'reseau', (SELECT c.valeur FROM pilotage.cibles_reseau c WHERE c.annee = p_annee AND public.mon_role() IN ('directeur', 'rr', 'coach', 'franchise')),
    'groupes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', gr.id, 'nom', gr.nom, 'cibles', cg.valeur) ORDER BY gr.nom)
      FROM pilotage.groupes gr
      LEFT JOIN pilotage.cibles_groupe cg ON cg.groupe_id = gr.id AND cg.annee = p_annee
      WHERE public.est_directeur()
         OR EXISTS (SELECT 1 FROM pilotage.groupe_magasins gm JOIN mes ON mes.m = gm.store_name WHERE gm.groupe_id = gr.id)), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION pilotage.budgets_du_compte(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.budgets_du_compte(integer) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0002', 'hypotheses_par_niveaux')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

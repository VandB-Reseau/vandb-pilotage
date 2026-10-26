-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — socle de la base (26/10/2026). Réexécutable.
-- Même base Supabase que l'app réseau, dans un espace à part : le schéma « pilotage ».
-- Suppose les migrations 0004 et 0005 de l'app réseau (rôles, franchisés, périmètre des Coachs et RR).
--
-- 1) Magasins du compte connecté : tous pour le Directeur de réseau, ceux de son périmètre pour un Coach
--    ou un RR, les siens pour un franchisé.
-- 2) Paramètres réseau par année (redevance, publicité, impôt, TVA du panier) : lus par tous les comptes
--    ouverts, écrits par le Directeur seul.
-- 3) Budget par magasin et par année : le siège propose (Directeur), le franchisé modifie ses hypothèses
--    (le budget passe « en discussion »), le Directeur valide. Coachs et RR lisent ceux de leurs magasins.
-- 4) Réel mensuel par magasin, univers et famille : importé par le Directeur, lu comme le budget.
-- Après le premier passage : ajouter « pilotage » aux schémas exposés de l'API Supabase.
-- ════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS pilotage;
REVOKE ALL ON SCHEMA pilotage FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pilotage TO authenticated, service_role;

-- ── 2) Paramètres réseau
CREATE TABLE IF NOT EXISTS pilotage.parametres_reseau (
  annee   integer PRIMARY KEY CHECK (annee BETWEEN 2020 AND 2100),
  valeur  jsonb NOT NULL CHECK (jsonb_typeof(valeur) = 'object'),
  maj_le  timestamptz NOT NULL DEFAULT now(),
  maj_par uuid DEFAULT auth.uid()
);

-- ── 3) Budgets
CREATE TABLE IF NOT EXISTS pilotage.budgets (
  store_name  text NOT NULL CHECK (store_name <> ''),
  annee       integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  statut      text NOT NULL DEFAULT 'propose' CHECK (statut IN ('propose', 'en_discussion', 'valide')),
  proposition jsonb NOT NULL CHECK (jsonb_typeof(proposition) = 'object'), -- hypothèses proposées par le siège
  hypotheses  jsonb NOT NULL CHECK (jsonb_typeof(hypotheses) = 'object'),  -- hypothèses retenues
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid DEFAULT auth.uid(),
  valide_le   timestamptz,
  PRIMARY KEY (store_name, annee)
);

-- Garde du circuit « le siège propose, on se met d'accord » : hors Directeur, on ne touche ni à la
-- proposition, ni à un budget validé, et on ne valide pas ; une modification remet le budget en discussion.
CREATE OR REPLACE FUNCTION pilotage.garde_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  IF public.est_directeur() THEN
    IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut <> 'valide') THEN NEW.valide_le := now(); END IF;
    IF NEW.statut <> 'valide' THEN NEW.valide_le := NULL; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF OLD.statut = 'valide' THEN RAISE EXCEPTION 'budget_valide'; END IF;
  IF NEW.store_name <> OLD.store_name OR NEW.annee <> OLD.annee OR NEW.proposition IS DISTINCT FROM OLD.proposition THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  NEW.statut := 'en_discussion';
  NEW.valide_le := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS garde_budget ON pilotage.budgets;
CREATE TRIGGER garde_budget BEFORE INSERT OR UPDATE ON pilotage.budgets FOR EACH ROW EXECUTE FUNCTION pilotage.garde_budget();

-- ── 4) Réel mensuel
CREATE TABLE IF NOT EXISTS pilotage.reel_mensuel (
  store_name text NOT NULL CHECK (store_name <> ''),
  mois       date NOT NULL CHECK (extract(day FROM mois) = 1),
  univers    text NOT NULL CHECK (univers IN ('cave', 'bar', 'exterieur')),
  famille    text NOT NULL CHECK (famille <> ''),
  ca_ht      numeric NOT NULL DEFAULT 0,
  marge_ht   numeric,
  tickets    integer,
  importe_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_name, mois, univers, famille)
);

-- ── 1) Magasins du compte connecté (écrite après les tables qu'elle lit)
CREATE OR REPLACE FUNCTION pilotage.mes_magasins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE public.mon_role()
    WHEN 'directeur' THEN coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM (
      SELECT p.store_name AS m FROM public.perimetre_equipe p
      UNION SELECT b.store_name FROM pilotage.budgets b) x), '{}'::text[])
    WHEN 'coach' THEN public.magasins_visibles()
    WHEN 'rr' THEN public.magasins_visibles()
    WHEN 'franchise' THEN public.mes_magasins()
    ELSE '{}'::text[] END
$$;

-- ── Journal des migrations de l'app de pilotage (séparé de celui de l'app réseau)
CREATE TABLE IF NOT EXISTS pilotage.journal_migrations (
  numero    text PRIMARY KEY,
  nom       text NOT NULL,
  passee_le timestamptz NOT NULL DEFAULT now()
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['parametres_reseau', 'budgets', 'reel_mensuel', 'journal_migrations'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

CREATE POLICY "comptes_ouverts_lecture" ON pilotage.parametres_reseau FOR SELECT TO authenticated
  USING ((SELECT public.mon_role()) IN ('directeur', 'rr', 'coach', 'franchise'));
CREATE POLICY "directeur_ecriture" ON pilotage.parametres_reseau FOR ALL TO authenticated
  USING ((SELECT public.est_directeur())) WITH CHECK ((SELECT public.est_directeur()));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.parametres_reseau TO authenticated;

CREATE POLICY "perimetre_lecture" ON pilotage.budgets FOR SELECT TO authenticated
  USING ((SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "directeur_creation" ON pilotage.budgets FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_directeur()));
CREATE POLICY "directeur_ou_franchise_modification" ON pilotage.budgets FOR UPDATE TO authenticated
  USING ((SELECT public.mon_role()) IN ('directeur', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name])
  WITH CHECK ((SELECT public.mon_role()) IN ('directeur', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "directeur_suppression" ON pilotage.budgets FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.budgets TO authenticated;

CREATE POLICY "perimetre_lecture" ON pilotage.reel_mensuel FOR SELECT TO authenticated
  USING ((SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "directeur_ecriture" ON pilotage.reel_mensuel FOR ALL TO authenticated
  USING ((SELECT public.est_directeur())) WITH CHECK ((SELECT public.est_directeur()));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.reel_mensuel TO authenticated;

CREATE POLICY "directeur_lecture" ON pilotage.journal_migrations FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()));
GRANT SELECT ON pilotage.journal_migrations TO authenticated;

-- ── Tableau des magasins du compte, avec leur budget de l'année demandée
CREATE OR REPLACE FUNCTION pilotage.magasins_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'magasin', m, 'statut', b.statut, 'hypotheses', b.hypotheses, 'maj_le', b.maj_le) ORDER BY m), '[]'::jsonb)
  FROM unnest(pilotage.mes_magasins()) m
  LEFT JOIN pilotage.budgets b ON b.store_name = m AND b.annee = p_annee
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['mes_magasins()', 'magasins_du_compte(integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION pilotage.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION pilotage.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION pilotage.garde_budget() FROM PUBLIC, anon, authenticated;
END $$;

-- Paramètres 2027 décidés par Joseph le 26/10/2026 (posés une seule fois, ensuite tenus depuis l'app)
INSERT INTO pilotage.parametres_reseau (annee, valeur, maj_par) VALUES (2027, jsonb_build_object(
  'tauxRedevance', 0.02, 'tauxPublicite', 0.01,
  'impot', jsonb_build_object('tauxReduit', 0.15, 'plafondTauxReduit', 42500, 'tauxNormal', 0.25),
  'tvaPanier', jsonb_build_object('cave', 0.2, 'bar', 0.18)), NULL)
ON CONFLICT (annee) DO NOTHING;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0001', 'socle_pilotage')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

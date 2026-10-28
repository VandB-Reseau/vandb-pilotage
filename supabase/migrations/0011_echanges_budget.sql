-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — échanges sur le budget et historique de ses versions (28/10/2026). Réexécutable.
-- « Le siège propose, on se met d'accord » : messages par sujet (général, CA, marge, personnel, frais, travaux,
-- trésorerie) entre le siège, le RR, le Coach et le franchisé, sur le budget d'un magasin et d'une année ; chaque
-- changement de statut, de base ou d'ajustements du budget laisse une version (qui, quand, quoi).
-- Auteur, rôle et nom posés par la base, jamais par l'app. Suppose 0001 et 0002.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.echanges_budget (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name  text NOT NULL CHECK (store_name <> ''),
  annee       integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  sujet       text NOT NULL DEFAULT 'general' CHECK (sujet IN ('general', 'ca', 'marge', 'personnel', 'frais', 'travaux', 'tresorerie')),
  texte       text NOT NULL CHECK (length(trim(texte)) BETWEEN 1 AND 2000),
  auteur      uuid DEFAULT auth.uid(),
  auteur_role text,
  auteur_nom  text,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echanges_budget_magasin ON pilotage.echanges_budget (store_name, annee, cree_le);

CREATE TABLE IF NOT EXISTS pilotage.versions_budget (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name  text NOT NULL,
  annee       integer NOT NULL,
  statut      text NOT NULL,
  base        jsonb,
  ajustements jsonb NOT NULL DEFAULT '{}'::jsonb,
  auteur      uuid,
  auteur_role text,
  auteur_nom  text,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS versions_budget_magasin ON pilotage.versions_budget (store_name, annee, cree_le);

-- Nom de l'auteur : celui du Coach, du RR (fiche de l'app réseau) ou de la franchise ; rien pour le Directeur
CREATE OR REPLACE FUNCTION pilotage.mon_nom() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE public.mon_role()
    WHEN 'coach' THEN (SELECT nullif(trim(u.raw_app_meta_data->>'coach'), '') FROM auth.users u WHERE u.id = auth.uid())
    WHEN 'rr' THEN (
      SELECT nullif(trim(d->>'name'), '')
      FROM auth.users u, public.app_config c,
        jsonb_array_elements(CASE WHEN jsonb_typeof(public.json_sur(c.value)->'drs') = 'array' THEN public.json_sur(c.value)->'drs' ELSE '[]'::jsonb END) d
      WHERE u.id = auth.uid() AND c.key = 'drs_data' AND d->>'id' = u.raw_app_meta_data->>'rr' LIMIT 1)
    WHEN 'franchise' THEN (SELECT nullif(trim(a.franchise), '') FROM public.acces_franchises a WHERE a.user_id = auth.uid())
  END
$$;
REVOKE ALL ON FUNCTION pilotage.mon_nom() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.mon_nom() TO authenticated;

-- Message : auteur, rôle, nom et date posés ici
CREATE OR REPLACE FUNCTION pilotage.echanges_budget_auteur() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.auteur := auth.uid();
  NEW.auteur_role := public.mon_role();
  NEW.auteur_nom := pilotage.mon_nom();
  NEW.cree_le := now();
  NEW.texte := trim(NEW.texte);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS echanges_budget_auteur ON pilotage.echanges_budget;
CREATE TRIGGER echanges_budget_auteur BEFORE INSERT ON pilotage.echanges_budget FOR EACH ROW EXECUTE FUNCTION pilotage.echanges_budget_auteur();

-- Version : à la création du budget et à chaque changement de statut, de base ou d'ajustements
CREATE OR REPLACE FUNCTION pilotage.versions_budget_trace() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut AND NEW.base IS NOT DISTINCT FROM OLD.base
     AND NEW.ajustements IS NOT DISTINCT FROM OLD.ajustements THEN
    RETURN NULL;
  END IF;
  INSERT INTO pilotage.versions_budget (store_name, annee, statut, base, ajustements, auteur, auteur_role, auteur_nom)
  VALUES (NEW.store_name, NEW.annee, NEW.statut, NEW.base, NEW.ajustements, auth.uid(), public.mon_role(), pilotage.mon_nom());
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pilotage.versions_budget_trace() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS versions_budget_trace ON pilotage.budgets;
CREATE TRIGGER versions_budget_trace AFTER INSERT OR UPDATE ON pilotage.budgets FOR EACH ROW EXECUTE FUNCTION pilotage.versions_budget_trace();

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['echanges_budget', 'versions_budget'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- Lus sur les magasins du compte. Messages écrits par chacun sur ses magasins, retirés par leur seul auteur.
-- Versions écrites par la base seule.
CREATE POLICY "perimetre_lecture" ON pilotage.echanges_budget FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.echanges_budget FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
CREATE POLICY "auteur_retrait" ON pilotage.echanges_budget FOR DELETE TO authenticated
  USING (auteur = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON pilotage.echanges_budget TO authenticated;

CREATE POLICY "perimetre_lecture" ON pilotage.versions_budget FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
GRANT SELECT ON pilotage.versions_budget TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0011', 'echanges_budget')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

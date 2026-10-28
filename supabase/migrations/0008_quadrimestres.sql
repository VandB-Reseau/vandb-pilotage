-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — chiffres comptables par quadrimestre (28/10/2026). Réexécutable.
-- Tous les 4 mois, quelques montants agrégés par magasin, saisis ou importés : achats de marchandises, variation de
-- stock (stock de fin − stock de début), charges externes (redevance et publicité comprises), impôts et taxes, frais de
-- personnel, trésorerie en fin de période. Le CA vient de la caisse ; la marge réelle et l'EBE se calculent dans l'app
-- (décision de Joseph, 28/10/2026 : rien d'autre à saisir).
-- Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins, comme les frais.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.quadrimestres (
  store_name       text NOT NULL CHECK (store_name <> ''),
  annee            integer NOT NULL CHECK (annee BETWEEN 2000 AND 2100),
  quadrimestre     smallint NOT NULL CHECK (quadrimestre BETWEEN 1 AND 3),
  achats           numeric CHECK (achats >= 0),
  variation_stock  numeric,
  charges_externes numeric CHECK (charges_externes >= 0),
  impots_taxes     numeric CHECK (impots_taxes >= 0),
  personnel        numeric CHECK (personnel >= 0),
  tresorerie       numeric,
  maj_le           timestamptz NOT NULL DEFAULT now(),
  maj_par          uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, annee, quadrimestre)
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.quadrimestres ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'quadrimestres' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.quadrimestres', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.quadrimestres FROM PUBLIC, anon, authenticated;
END $$;

-- Lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.quadrimestres FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.quadrimestres FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.quadrimestres TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.quadrimestres_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS quadrimestres_maj ON pilotage.quadrimestres;
CREATE TRIGGER quadrimestres_maj BEFORE UPDATE ON pilotage.quadrimestres FOR EACH ROW EXECUTE FUNCTION pilotage.quadrimestres_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0008', 'quadrimestres')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

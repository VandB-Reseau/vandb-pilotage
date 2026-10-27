-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — frais des magasins ligne par ligne (27/10/2026). Réexécutable.
-- Frais annuels de l'année en cours, sur la grille du réseau (src/moteur/parametres.ts) : montant par an ou part du CA.
-- Emprunts et amortissements dans la même table, rubrique « hors_exploitation ». Saisie par le Directeur, le RR, le
-- Coach ou le franchisé, chacun sur ses magasins (décision de Joseph, 27/10/2026).
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.frais (
  store_name text NOT NULL CHECK (store_name <> ''),
  code       text NOT NULL CHECK (code ~ '^[a-z_]{2,40}$'),
  libelle    text NOT NULL CHECK (btrim(libelle) <> '' AND length(libelle) <= 80),
  rubrique   text NOT NULL CHECK (rubrique IN ('immobilier', 'energies', 'entretien', 'honoraires', 'communication', 'deplacements',
                                               'banque_assurances', 'autres', 'impots_taxes', 'hors_exploitation')),
  annuel     numeric CHECK (annuel >= 0),
  taux_ca    numeric CHECK (taux_ca BETWEEN 0 AND 1),
  maj_le     timestamptz NOT NULL DEFAULT now(),
  maj_par    uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, code),
  CHECK ((annuel IS NULL) <> (taux_ca IS NULL))
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.frais ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'frais' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.frais', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.frais FROM PUBLIC, anon, authenticated;
END $$;

-- Lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.frais FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.frais FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.frais TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.frais_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS frais_maj ON pilotage.frais;
CREATE TRIGGER frais_maj BEFORE UPDATE ON pilotage.frais FOR EACH ROW EXECUTE FUNCTION pilotage.frais_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0005', 'frais')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

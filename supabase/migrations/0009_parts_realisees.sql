-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — part de l'année réalisée saisie par univers (28/10/2026). Réexécutable.
-- Sans réel de l'an dernier, l'atterrissage ne connaît pas la saisonnalité du magasin. La part de l'année réalisée à fin
-- du dernier mois (Cave, Bar, Extérieur) peut alors être saisie, comme dans le prévisionnel Excel : CA atterri = réalisé /
-- part. Une ligne par magasin, année et univers ; pas de ligne : calcul automatique.
-- Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins, comme les frais.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.parts_realisees (
  store_name  text NOT NULL CHECK (store_name <> ''),
  annee       integer NOT NULL CHECK (annee BETWEEN 2000 AND 2100),
  univers     text NOT NULL CHECK (univers IN ('cave', 'bar', 'exterieur')),
  part        numeric NOT NULL CHECK (part > 0 AND part <= 1),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, annee, univers)
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.parts_realisees ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'parts_realisees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.parts_realisees', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.parts_realisees FROM PUBLIC, anon, authenticated;
END $$;

-- Lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.parts_realisees FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.parts_realisees FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.parts_realisees TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.parts_realisees_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS parts_realisees_maj ON pilotage.parts_realisees;
CREATE TRIGGER parts_realisees_maj BEFORE UPDATE ON pilotage.parts_realisees FOR EACH ROW EXECUTE FUNCTION pilotage.parts_realisees_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0009', 'parts_realisees')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

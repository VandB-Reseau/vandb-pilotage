-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — correspondance des comptes du FEC propre à chaque magasin (28/10/2026). Réexécutable.
-- L'import du FEC range chaque compte de charges sur les racines du plan comptable général. Quand le cabinet du magasin
-- range un compte autrement (charges diverses en 658, par exemple), le choix fait une fois est gardé ici pour les
-- imports suivants. Une ligne par magasin et par compte ; pas de ligne : correspondance par défaut.
-- Le FEC lui-même n'est jamais enregistré. Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.correspondances_fec (
  store_name  text NOT NULL CHECK (store_name <> ''),
  compte      text NOT NULL CHECK (compte ~ '^6[0-9A-Za-z]*$'),
  rubrique    text NOT NULL CHECK (rubrique IN ('achats', 'variation_stock', 'charges_externes', 'impots_taxes', 'personnel', 'hors_ebe')),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, compte)
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.correspondances_fec ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'correspondances_fec' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.correspondances_fec', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.correspondances_fec FROM PUBLIC, anon, authenticated;
END $$;

-- Lues sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.correspondances_fec FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.correspondances_fec FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.correspondances_fec TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.correspondances_fec_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS correspondances_fec_maj ON pilotage.correspondances_fec;
CREATE TRIGGER correspondances_fec_maj BEFORE UPDATE ON pilotage.correspondances_fec FOR EACH ROW EXECUTE FUNCTION pilotage.correspondances_fec_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0010', 'correspondances_fec')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — valeur du stock en fin de mois (03/11/2026). Réexécutable.
-- Joseph : piloter la valeur du stock mois par mois face à une cible de 2,5 mois d'achats pour la Cave et 1 mois pour
-- le Bar, au prix d'achat. Le franchisé saisit chaque mois la valeur de son stock au prix d'achat HT au dernier jour du
-- mois, Cave et Bar séparés (lue dans son logiciel de caisse ou issue d'un inventaire).
-- Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins, comme les quadrimestres.
-- La cible (mois de stock par univers, tolérance) est un paramètre réseau (parametres_reseau.valeur.tresorerie.stock) :
-- rien à créer pour elle.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.stocks (
  store_name text NOT NULL CHECK (store_name <> ''),
  annee      integer NOT NULL CHECK (annee BETWEEN 2000 AND 2100),
  mois       smallint NOT NULL CHECK (mois BETWEEN 1 AND 12),
  cave       numeric CHECK (cave >= 0),
  bar        numeric CHECK (bar >= 0),
  maj_le     timestamptz NOT NULL DEFAULT now(),
  maj_par    uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, annee, mois)
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.stocks ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'stocks' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.stocks', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.stocks FROM PUBLIC, anon, authenticated;
END $$;

-- Lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.stocks FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.stocks FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.stocks TO authenticated;

-- Date et auteur de la mise à jour
CREATE OR REPLACE FUNCTION pilotage.stocks_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stocks_maj ON pilotage.stocks;
CREATE TRIGGER stocks_maj BEFORE INSERT OR UPDATE ON pilotage.stocks FOR EACH ROW EXECUTE FUNCTION pilotage.stocks_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0023', 'stock_fin_de_mois')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

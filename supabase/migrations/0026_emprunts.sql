-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — prêts des magasins (03/11/2026). Réexécutable.
-- Décision de Joseph : les prêts se saisissent une fois dans la fiche du magasin, comme l'équipe, avec leur date de
-- début ; l'application en tire les intérêts et le capital de chaque mois, pour l'année en cours, les suivantes et les
-- précédentes. Deux saisies :
--   - « initial » : d'après le tableau d'amortissement de la banque (montant emprunté, taux, durée, 1re échéance,
--     différé en mois d'intérêts seuls) ;
--   - « restant » : faute du tableau, capital restant dû juste avant l'échéance de « debut » et mensualité.
-- Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins.
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.emprunts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name  text NOT NULL CHECK (store_name <> ''),
  libelle     text NOT NULL CHECK (btrim(libelle) <> '' AND length(libelle) <= 80),
  mode        text NOT NULL DEFAULT 'initial' CHECK (mode IN ('initial', 'restant')),
  montant     numeric NOT NULL CHECK (montant > 0),
  taux        numeric NOT NULL DEFAULT 0 CHECK (taux BETWEEN 0 AND 0.3),
  duree       numeric CHECK (duree IS NULL OR duree BETWEEN 0 AND 40),
  debut       date NOT NULL CHECK (extract(day FROM debut) = 1),
  differe     integer NOT NULL DEFAULT 0 CHECK (differe BETWEEN 0 AND 60),
  mensualite  numeric CHECK (mensualite IS NULL OR mensualite > 0),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid DEFAULT auth.uid(),
  CHECK ((mode = 'initial' AND coalesce(duree, 0) > 0) OR (mode = 'restant' AND mensualite IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS emprunts_magasin ON pilotage.emprunts (store_name);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.emprunts ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'emprunts' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.emprunts', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.emprunts FROM PUBLIC, anon, authenticated;
END $$;

-- Lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.emprunts FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.emprunts FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.emprunts TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.emprunts_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS emprunts_maj ON pilotage.emprunts;
CREATE TRIGGER emprunts_maj BEFORE UPDATE ON pilotage.emprunts FOR EACH ROW EXECUTE FUNCTION pilotage.emprunts_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0026', 'emprunts')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

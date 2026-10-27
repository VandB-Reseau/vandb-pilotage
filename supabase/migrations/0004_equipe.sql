-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — équipe des magasins (27/10/2026). Réexécutable.
-- Décisions de Joseph : une ligne par poste (« Vendeur 1 », « Vendeur 2 »), sans nom ; heures et salaire propres à
-- chacun ; primes annuelles possibles ; le gérant figure dans la liste s'il se rémunère (souvent TNS). Saisie par le
-- Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins. Les taux de charges et la réduction générale
-- sont dans parametres_reseau.valeur.charges (sans changement de table).
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.equipe (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name   text NOT NULL CHECK (store_name <> ''),
  poste        text NOT NULL CHECK (btrim(poste) <> '' AND length(poste) <= 80),
  categorie    text NOT NULL CHECK (categorie IN ('employe', 'agent_maitrise', 'cadre', 'apprenti', 'gerant_tns')),
  heures_hebdo numeric NOT NULL CHECK (heures_hebdo BETWEEN 0 AND 70),
  brut_mensuel numeric NOT NULL CHECK (brut_mensuel >= 0),
  primes       jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(primes) = 'array'),
  entree       date CHECK (extract(day FROM entree) = 1),
  sortie       date CHECK (extract(day FROM sortie) = 1),
  maj_le       timestamptz NOT NULL DEFAULT now(),
  maj_par      uuid DEFAULT auth.uid(),
  CHECK (sortie IS NULL OR entree IS NULL OR sortie >= entree)
);
CREATE INDEX IF NOT EXISTS equipe_magasin ON pilotage.equipe (store_name);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.equipe ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'equipe' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.equipe', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.equipe FROM PUBLIC, anon, authenticated;
END $$;

-- Lue sur les magasins du compte ; écrite par le Directeur partout, par le RR, le Coach et le franchisé sur leurs magasins
CREATE POLICY "perimetre_lecture" ON pilotage.equipe FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "perimetre_ecriture" ON pilotage.equipe FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.equipe TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.equipe_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS equipe_maj ON pilotage.equipe;
CREATE TRIGGER equipe_maj BEFORE UPDATE ON pilotage.equipe FOR EACH ROW EXECUTE FUNCTION pilotage.equipe_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0004', 'equipe')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

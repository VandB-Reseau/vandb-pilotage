-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — versions nommées du budget, primes d'équipe et heures au mois (lot 26, 28/10/2026). Réexécutable.
-- - Versions nommées : chacun enregistre une version du budget d'un magasin (« prudente », « ambitieuse »…) sans toucher
--   au budget en cours, puis les compare côte à côte. Elles remplacent l'onglet « Et si ». Auteur, rôle et nom posés par
--   la base. Lues sur les magasins du compte, écrites par le Directeur et le franchisé (ceux qui ajustent le budget),
--   retirées par leur auteur ou le Directeur.
-- - Équipe : unité de saisie des heures (semaine ou mois ; le calcul garde les heures par semaine) et primes d'équipe
--   sans salarié (enveloppe). Mêmes règles d'accès que l'équipe (0004), inchangées.
-- Suppose 0004 et 0011.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.equipe ADD COLUMN IF NOT EXISTS heures_saisie text NOT NULL DEFAULT 'semaine';
ALTER TABLE pilotage.equipe ADD COLUMN IF NOT EXISTS enveloppe boolean NOT NULL DEFAULT false;
ALTER TABLE pilotage.equipe DROP CONSTRAINT IF EXISTS equipe_heures_saisie;
ALTER TABLE pilotage.equipe ADD CONSTRAINT equipe_heures_saisie CHECK (heures_saisie IN ('semaine', 'mois'));

CREATE TABLE IF NOT EXISTS pilotage.versions_nommees (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name  text NOT NULL CHECK (store_name <> ''),
  annee       integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  nom         text NOT NULL CHECK (length(trim(nom)) BETWEEN 1 AND 80),
  base        jsonb NOT NULL CHECK (jsonb_typeof(base) = 'object'),
  ajustements jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ajustements) = 'object'),
  auteur      uuid DEFAULT auth.uid(),
  auteur_role text,
  auteur_nom  text,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS versions_nommees_magasin ON pilotage.versions_nommees (store_name, annee, cree_le);

-- Auteur, rôle, nom et date posés ici
CREATE OR REPLACE FUNCTION pilotage.versions_nommees_auteur() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.auteur := auth.uid();
  NEW.auteur_role := public.mon_role();
  NEW.auteur_nom := pilotage.mon_nom();
  NEW.cree_le := now();
  NEW.nom := trim(NEW.nom);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS versions_nommees_auteur ON pilotage.versions_nommees;
CREATE TRIGGER versions_nommees_auteur BEFORE INSERT ON pilotage.versions_nommees FOR EACH ROW EXECUTE FUNCTION pilotage.versions_nommees_auteur();

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.versions_nommees ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'versions_nommees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.versions_nommees', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.versions_nommees FROM PUBLIC, anon, authenticated;
END $$;

CREATE POLICY "perimetre_lecture" ON pilotage.versions_nommees FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "ecriture" ON pilotage.versions_nommees FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) = 'franchise' AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
CREATE POLICY "auteur_ou_directeur_retrait" ON pilotage.versions_nommees FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()) OR auteur = (SELECT auth.uid()));
GRANT SELECT, INSERT, DELETE ON pilotage.versions_nommees TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0015', 'versions_et_equipe')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

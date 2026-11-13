-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulations gardées (choix 126, Joseph 13/11/2026). Réexécutable.
-- Les simulateurs du franchisé (embauche, promo, coup dur de trésorerie, vente additionnelle, reste à faire du mois,
-- soirée, achat en volume, investissement) ne gardent rien par défaut. « Garder » range ici la simulation, nommée, avec
-- ses chiffres saisis et une phrase de résultat : le franchisé et l'équipe du magasin la retrouvent (le Coach la reprend
-- en visite). On ne la modifie pas : on en garde une autre ou on la retire.
-- Écrite par le Directeur, le RR, le Coach ou le franchisé, chacun sur ses magasins ; retirée par son auteur ou le Directeur.
-- Suppose 0001_socle_pilotage.sql et 0011_echanges_budget.sql (pilotage.mon_nom).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.simulations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name  text NOT NULL CHECK (store_name <> ''),
  type        text NOT NULL CHECK (type IN ('embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement')),
  nom         text NOT NULL CHECK (btrim(nom) <> '' AND length(nom) <= 80),
  donnees     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(donnees) = 'object' AND length(donnees::text) <= 20000),
  resume      text NOT NULL DEFAULT '' CHECK (length(resume) <= 300),
  auteur      uuid NOT NULL DEFAULT auth.uid(),
  auteur_nom  text,
  auteur_role text,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simulations_magasin ON pilotage.simulations (store_name, cree_le DESC);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.simulations ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'simulations' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.simulations', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.simulations FROM PUBLIC, anon, authenticated;
END $$;

CREATE POLICY "perimetre_lecture" ON pilotage.simulations FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
-- Garder : sur ses magasins, en son nom (l'auteur est le compte connecté)
CREATE POLICY "perimetre_ajout" ON pilotage.simulations FOR INSERT TO authenticated
  WITH CHECK (auteur = auth.uid() AND ((SELECT public.est_directeur())
    OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name])));
-- Retirer : son auteur sur ses magasins, ou le Directeur
CREATE POLICY "auteur_retrait" ON pilotage.simulations FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()) OR (auteur = auth.uid() AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, DELETE ON pilotage.simulations TO authenticated;

-- Rôle et nom de l'auteur posés par la base, jamais par l'écran (comme les commentaires, 0011)
CREATE OR REPLACE FUNCTION pilotage.simulations_auteur() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.auteur_role := public.mon_role();
  NEW.auteur_nom := pilotage.mon_nom();
  NEW.cree_le := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS simulations_auteur ON pilotage.simulations;
CREATE TRIGGER simulations_auteur BEFORE INSERT ON pilotage.simulations FOR EACH ROW EXECUTE FUNCTION pilotage.simulations_auteur();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0031', 'simulations')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

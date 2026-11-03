-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — années du pilotage (03/11/2026). Réexécutable.
-- Décision de Joseph (option 2 de la maquette « Passage d'année ») : ce n'est plus le calendrier qui fait passer
-- l'application d'une année à l'autre, c'est le Directeur, depuis Paramètres :
--   - « Ouvrir la campagne N+1 » : l'onglet Budget N+1 apparaît pour tous ; les paramètres réseau, les hypothèses du
--     réseau et des groupes de N sont repris pour N+1 quand ils n'existent pas encore (rien n'est écrasé) ;
--   - « Démarrer le suivi N+1 » : le suivi passe à N+1 ; N reste ouvert à la saisie (décembre, 3e quadrimestre) ; les
--     frais du magasin de N sont gardés en archive avant d'être modifiés pour N+1 ;
--   - « Clore N » : N passe dans les années passées, en lecture.
-- États d'une année : campagne → suivi → close. Une année absente de la table est « en préparation ».
-- Point de départ : 2026 suivie, campagne 2027 ouverte. Rien ne change pour le terrain le jour du passage.
-- Suppose 0001_socle_pilotage.sql, 0002 (cibles), 0005 (frais).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.annees (
  annee        integer PRIMARY KEY CHECK (annee BETWEEN 2020 AND 2100),
  etat         text NOT NULL CHECK (etat IN ('campagne', 'suivi', 'close')),
  campagne_le  timestamptz,
  suivi_le     timestamptz,
  close_le     timestamptz,
  maj_par      uuid DEFAULT auth.uid()
);
INSERT INTO pilotage.annees (annee, etat, suivi_le) VALUES (2026, 'suivi', now()) ON CONFLICT (annee) DO NOTHING;
INSERT INTO pilotage.annees (annee, etat, campagne_le) VALUES (2027, 'campagne', now()) ON CONFLICT (annee) DO NOTHING;

-- Frais du magasin gardés à la fin de chaque année (photo prise au démarrage du suivi de l'année suivante)
CREATE TABLE IF NOT EXISTS pilotage.frais_archives (
  annee       integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  store_name  text NOT NULL CHECK (store_name <> ''),
  code        text NOT NULL,
  libelle     text NOT NULL,
  rubrique    text NOT NULL,
  annuel      numeric,
  taux_ca     numeric,
  archive_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (annee, store_name, code)
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['annees', 'frais_archives'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- Années : lues par tous les comptes qui ont un rôle ; changées seulement par les fonctions ci-dessous (Directeur)
CREATE POLICY "lecture_avec_role" ON pilotage.annees FOR SELECT TO authenticated
  USING ((SELECT public.mon_role()) IN ('directeur', 'rr', 'coach', 'franchise'));
GRANT SELECT ON pilotage.annees TO authenticated;

-- Archives des frais : lues comme les frais, sur les magasins du compte ; écrites seulement par demarrer_suivi
CREATE POLICY "perimetre_lecture" ON pilotage.frais_archives FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
GRANT SELECT ON pilotage.frais_archives TO authenticated;

-- Ouvrir la campagne N : N = année suivie la plus récente + 1, une seule campagne ouverte à la fois
CREATE OR REPLACE FUNCTION pilotage.ouvrir_campagne(p_annee integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE suivie integer;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'reserve_directeur'; END IF;
  SELECT max(annee) INTO suivie FROM pilotage.annees WHERE etat IN ('suivi', 'close');
  IF suivie IS NULL OR p_annee <> suivie + 1 THEN RAISE EXCEPTION 'annee_inattendue'; END IF;
  IF EXISTS (SELECT 1 FROM pilotage.annees WHERE etat = 'campagne' AND annee <> p_annee) THEN RAISE EXCEPTION 'campagne_deja_ouverte'; END IF;
  INSERT INTO pilotage.annees (annee, etat, campagne_le, maj_par) VALUES (p_annee, 'campagne', now(), auth.uid())
  ON CONFLICT (annee) DO NOTHING;
  -- Reprise de l'année d'avant, sans rien écraser ; les dates de campagne restent celles par défaut de la nouvelle année
  INSERT INTO pilotage.parametres_reseau (annee, valeur)
    SELECT p_annee, valeur - 'campagne' FROM pilotage.parametres_reseau WHERE annee = p_annee - 1 ON CONFLICT (annee) DO NOTHING;
  INSERT INTO pilotage.cibles_reseau (annee, valeur)
    SELECT p_annee, valeur FROM pilotage.cibles_reseau WHERE annee = p_annee - 1 ON CONFLICT (annee) DO NOTHING;
  INSERT INTO pilotage.cibles_groupe (groupe_id, annee, valeur)
    SELECT groupe_id, p_annee, valeur FROM pilotage.cibles_groupe WHERE annee = p_annee - 1 ON CONFLICT (groupe_id, annee) DO NOTHING;
END $$;

-- Démarrer le suivi N : la campagne N devient l'année suivie ; les frais de N-1 sont archivés
CREATE OR REPLACE FUNCTION pilotage.demarrer_suivi(p_annee integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'reserve_directeur'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pilotage.annees WHERE annee = p_annee AND etat = 'campagne') THEN RAISE EXCEPTION 'pas_de_campagne'; END IF;
  INSERT INTO pilotage.frais_archives (annee, store_name, code, libelle, rubrique, annuel, taux_ca)
    SELECT p_annee - 1, store_name, code, libelle, rubrique, annuel, taux_ca FROM pilotage.frais
  ON CONFLICT (annee, store_name, code) DO NOTHING;
  UPDATE pilotage.annees SET etat = 'suivi', suivi_le = now(), maj_par = auth.uid() WHERE annee = p_annee;
END $$;

-- Clore N : seulement une année suivie qui n'est plus la plus récente
CREATE OR REPLACE FUNCTION pilotage.clore_annee(p_annee integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'reserve_directeur'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pilotage.annees WHERE annee = p_annee AND etat = 'suivi')
     OR NOT EXISTS (SELECT 1 FROM pilotage.annees WHERE annee > p_annee AND etat = 'suivi') THEN RAISE EXCEPTION 'annee_pas_a_clore'; END IF;
  UPDATE pilotage.annees SET etat = 'close', close_le = now(), maj_par = auth.uid() WHERE annee = p_annee;
END $$;

REVOKE ALL ON FUNCTION pilotage.ouvrir_campagne(integer), pilotage.demarrer_suivi(integer), pilotage.clore_annee(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.ouvrir_campagne(integer), pilotage.demarrer_suivi(integer), pilotage.clore_annee(integer) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0027', 'annees')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

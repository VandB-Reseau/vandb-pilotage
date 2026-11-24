-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — commentaires du budget « équipe seule » et mentions (Joseph, 24/11/2026). Réexécutable.
-- Les commentaires du budget passent dans la marge, à côté de leur ligne ; chacun dit qui le lit :
--   equipe = false (par défaut) : le magasin entier, franchisé compris, comme avant ;
--   equipe = true : l'équipe seule (Directeur, RR, Coach, contrôle de gestion). Le franchisé ne le lit pas, ne l'écrit
--   pas, ne le résout pas. Une réponse prend la visibilité de son commentaire.
-- mentions : noms des collègues prévenus (cloche de l'app réseau), 10 au plus, posés par l'auteur.
-- Aucune règle n'est rouverte : deux règles restrictives s'ajoutent à celles de 0011, qui restent telles quelles.
-- Suppose 0011 et 0025. À passer AVANT la migration réseau 0053 (notifications sans le franchisé).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS equipe boolean NOT NULL DEFAULT false;
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS mentions text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'echanges_budget_mentions_bornees') THEN
    ALTER TABLE pilotage.echanges_budget ADD CONSTRAINT echanges_budget_mentions_bornees CHECK (cardinality(mentions) <= 10);
  END IF;
END $$;

-- Le franchisé ne lit ni n'écrit un commentaire de l'équipe (règles restrictives, en plus du périmètre de 0011)
DROP POLICY IF EXISTS "equipe_seule_lecture" ON pilotage.echanges_budget;
DROP POLICY IF EXISTS "equipe_seule_ecriture" ON pilotage.echanges_budget;
CREATE POLICY "equipe_seule_lecture" ON pilotage.echanges_budget AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT equipe OR (SELECT public.mon_role()) IS DISTINCT FROM 'franchise');
CREATE POLICY "equipe_seule_ecriture" ON pilotage.echanges_budget AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT equipe OR (SELECT public.mon_role()) IS DISTINCT FROM 'franchise');

-- Nouveau commentaire : comme 0025, plus la visibilité reprise du commentaire auquel on répond et des mentions nettoyées
CREATE OR REPLACE FUNCTION pilotage.echanges_budget_auteur() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE p record;
BEGIN
  NEW.auteur := auth.uid();
  NEW.auteur_role := public.mon_role();
  NEW.auteur_nom := pilotage.mon_nom();
  NEW.cree_le := now();
  NEW.texte := trim(NEW.texte);
  NEW.resolu_le := NULL; NEW.resolu_par_role := NULL; NEW.resolu_par_nom := NULL;
  NEW.mentions := coalesce((SELECT array_agg(DISTINCT left(trim(x), 80)) FROM unnest(NEW.mentions) x WHERE trim(x) <> ''), '{}');
  IF NEW.parent IS NOT NULL THEN
    SELECT store_name, annee, ancre, ancre_libelle, parent AS grand_parent, equipe INTO p FROM pilotage.echanges_budget WHERE id = NEW.parent;
    IF NOT FOUND OR p.grand_parent IS NOT NULL OR p.store_name <> NEW.store_name OR p.annee <> NEW.annee THEN
      RAISE EXCEPTION 'Réponse à un commentaire inconnu' USING ERRCODE = '23514';
    END IF;
    NEW.ancre := p.ancre; NEW.ancre_libelle := p.ancre_libelle; NEW.equipe := p.equipe;
  END IF;
  RETURN NEW;
END $$;

-- « Résolu » : comme 0025 ; un commentaire de l'équipe ne se résout pas par le franchisé
CREATE OR REPLACE FUNCTION pilotage.resoudre_commentaire(p_id bigint, p_resolu boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE magasin text; v_equipe boolean;
BEGIN
  SELECT store_name, equipe INTO magasin, v_equipe FROM pilotage.echanges_budget WHERE id = p_id AND parent IS NULL;
  IF magasin IS NULL OR (v_equipe AND public.mon_role() = 'franchise') THEN RAISE EXCEPTION 'Commentaire inconnu' USING ERRCODE = '42501'; END IF;
  IF NOT (public.est_directeur() OR (public.mon_role() IN ('rr', 'coach', 'franchise') AND pilotage.mes_magasins() @> ARRAY[magasin])) THEN
    RAISE EXCEPTION 'Commentaire hors du périmètre' USING ERRCODE = '42501';
  END IF;
  UPDATE pilotage.echanges_budget
  SET resolu_le = CASE WHEN p_resolu THEN now() END,
      resolu_par_role = CASE WHEN p_resolu THEN public.mon_role() END,
      resolu_par_nom = CASE WHEN p_resolu THEN pilotage.mon_nom() END
  WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION pilotage.resoudre_commentaire(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.resoudre_commentaire(bigint, boolean) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0037', 'commentaires_equipe')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

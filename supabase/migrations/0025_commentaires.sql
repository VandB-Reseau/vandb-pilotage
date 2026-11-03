-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — commentaires sur le budget (Joseph, 03/11/2026). Réexécutable.
-- Les échanges deviennent des commentaires comme dans un document partagé : posés sur un point précis du budget
-- (« ancre » : une carte, une hypothèse, un investissement, une ligne du résultat), avec des réponses (« parent ») et un
-- état « Résolu » que tout compte qui voit le magasin peut poser ou retirer. Les messages d'avant restent des
-- commentaires sur le budget en général. Aucune règle d'accès n'est rouverte : lecture, écriture et retrait suivent
-- celles de 0011 ; « Résolu » passe par une fonction qui vérifie le périmètre. Suppose 0011.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS ancre text NOT NULL DEFAULT 'budget';
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS ancre_libelle text;
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS parent bigint REFERENCES pilotage.echanges_budget (id) ON DELETE CASCADE;
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS resolu_le timestamptz;
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS resolu_par_role text;
ALTER TABLE pilotage.echanges_budget ADD COLUMN IF NOT EXISTS resolu_par_nom text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'echanges_budget_ancre_longueur') THEN
    ALTER TABLE pilotage.echanges_budget ADD CONSTRAINT echanges_budget_ancre_longueur
      CHECK (length(ancre) BETWEEN 1 AND 120 AND (ancre_libelle IS NULL OR length(ancre_libelle) <= 160));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS echanges_budget_parent ON pilotage.echanges_budget (parent);

-- Nouveau commentaire : auteur, rôle, nom et date posés par la base (0011) ; une réponse prend le magasin, l'année et
-- le point de son commentaire, ne se résout pas et ne répond pas à une réponse
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
  IF NEW.parent IS NOT NULL THEN
    SELECT store_name, annee, ancre, ancre_libelle, parent AS grand_parent INTO p FROM pilotage.echanges_budget WHERE id = NEW.parent;
    IF NOT FOUND OR p.grand_parent IS NOT NULL OR p.store_name <> NEW.store_name OR p.annee <> NEW.annee THEN
      RAISE EXCEPTION 'Réponse à un commentaire inconnu' USING ERRCODE = '23514';
    END IF;
    NEW.ancre := p.ancre; NEW.ancre_libelle := p.ancre_libelle;
  END IF;
  RETURN NEW;
END $$;

-- « Résolu » ou rouvert : un commentaire (pas une réponse) d'un magasin que le compte voit
CREATE OR REPLACE FUNCTION pilotage.resoudre_commentaire(p_id bigint, p_resolu boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE magasin text;
BEGIN
  SELECT store_name INTO magasin FROM pilotage.echanges_budget WHERE id = p_id AND parent IS NULL;
  IF magasin IS NULL THEN RAISE EXCEPTION 'Commentaire inconnu' USING ERRCODE = '42501'; END IF;
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

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0025', 'commentaires')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

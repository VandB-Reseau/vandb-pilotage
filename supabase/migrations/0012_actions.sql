-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — plan d'action relié aux alertes (28/10/2026). Réexécutable.
-- Une action par ligne : le magasin, l'alerte à laquelle elle répond (CA, marge, réel, trésorerie, ou autre), ce
-- qu'on fait, qui le fait, pour quand, et la mesure de l'alerte le jour où l'action est prise (pour en suivre l'effet).
-- Créée, modifiée, retirée par le Directeur partout, par le RR et le Coach sur leurs magasins ; lue par le franchisé,
-- qui peut seulement en changer le statut (faite, abandonnée). Auteur posé par la base. Suppose 0001 et 0011 (mon_nom).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.actions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_name    text NOT NULL CHECK (store_name <> ''),
  type_alerte   text NOT NULL CHECK (type_alerte IN ('ca', 'marge', 'reel', 'tresorerie', 'autre')),
  intitule      text NOT NULL CHECK (length(trim(intitule)) BETWEEN 1 AND 300),
  responsable   text NOT NULL CHECK (responsable IN ('franchise', 'coach', 'rr', 'directeur')),
  echeance      date,
  statut        text NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'faite', 'abandonnee')),
  annee         integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  depart        numeric,
  mois_depart   integer CHECK (mois_depart BETWEEN 1 AND 12),
  cree_par      uuid DEFAULT auth.uid(),
  cree_par_role text,
  cree_par_nom  text,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now(),
  faite_le      timestamptz
);
CREATE INDEX IF NOT EXISTS actions_magasin ON pilotage.actions (store_name, statut);

-- Auteur et dates posés ici ; le franchisé ne change que le statut
CREATE OR REPLACE FUNCTION pilotage.actions_garde() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.cree_par := auth.uid();
    NEW.cree_par_role := public.mon_role();
    NEW.cree_par_nom := pilotage.mon_nom();
    NEW.cree_le := now();
  ELSE
    IF public.mon_role() = 'franchise'
       AND (to_jsonb(NEW) - 'statut' - 'maj_le' - 'faite_le') IS DISTINCT FROM (to_jsonb(OLD) - 'statut' - 'maj_le' - 'faite_le') THEN
      RAISE EXCEPTION 'acces_refuse';
    END IF;
    NEW.cree_par := OLD.cree_par;
    NEW.cree_par_role := OLD.cree_par_role;
    NEW.cree_par_nom := OLD.cree_par_nom;
    NEW.cree_le := OLD.cree_le;
  END IF;
  NEW.intitule := trim(NEW.intitule);
  NEW.maj_le := now();
  NEW.faite_le := CASE WHEN NEW.statut = 'faite' THEN coalesce(CASE WHEN TG_OP = 'UPDATE' THEN OLD.faite_le END, now()) END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS actions_garde ON pilotage.actions;
CREATE TRIGGER actions_garde BEFORE INSERT OR UPDATE ON pilotage.actions FOR EACH ROW EXECUTE FUNCTION pilotage.actions_garde();

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.actions ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'actions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.actions', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.actions FROM PUBLIC, anon, authenticated;
END $$;

CREATE POLICY "perimetre_lecture" ON pilotage.actions FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "equipe_creation" ON pilotage.actions FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
CREATE POLICY "perimetre_modification" ON pilotage.actions FOR UPDATE TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))
  WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
CREATE POLICY "equipe_retrait" ON pilotage.actions FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN ('rr', 'coach') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.actions TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0012', 'actions')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

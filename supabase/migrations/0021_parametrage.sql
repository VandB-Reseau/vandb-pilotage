-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — paramétrage depuis l'app : contrôle de gestion et journal des changements (lot 39, 02/11/2026).
-- Réexécutable. Joseph (02/11/2026) : « il y aura quelqu'un du contrôle de gestion ». Le Directeur désigne dans le pilotage
-- les comptes du contrôle de gestion ; avec lui, ils sont seuls à modifier les paramètres réseau. Chaque changement de
-- paramètre est journalisé (qui, quand, avant, après). Les RR et les Coachs lisent les paramètres (inchangé) et le journal
-- pour les RR. Aucune table de l'app réseau n'est touchée : le rôle du compte reste lu par mon_role().
-- Suppose 0001.
-- ════════════════════════════════════════════════════════════════

-- ── Comptes du contrôle de gestion, désignés par le Directeur
CREATE TABLE IF NOT EXISTS pilotage.controle_gestion (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email    text NOT NULL,
  ajoute_le timestamptz NOT NULL DEFAULT now(),
  ajoute_par uuid DEFAULT auth.uid()
);

-- Peut modifier les paramètres réseau : le Directeur, ou un compte du contrôle de gestion
CREATE OR REPLACE FUNCTION pilotage.peut_parametrer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.est_directeur() OR EXISTS (SELECT 1 FROM pilotage.controle_gestion c WHERE c.user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION pilotage.peut_parametrer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.peut_parametrer() TO authenticated;

-- Droits du compte connecté propres au pilotage, lus par l'app à la connexion
CREATE OR REPLACE FUNCTION pilotage.mes_droits() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('parametrer', pilotage.peut_parametrer(),
    'controle_gestion', EXISTS (SELECT 1 FROM pilotage.controle_gestion c WHERE c.user_id = auth.uid()))
$$;
REVOKE ALL ON FUNCTION pilotage.mes_droits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.mes_droits() TO authenticated;

-- Désigner un compte par son email (le compte doit déjà exister) ; Directeur seul. Renvoie faux si l'email est inconnu.
CREATE OR REPLACE FUNCTION pilotage.ajouter_controle_gestion(p_email text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT id INTO u FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF u IS NULL THEN RETURN false; END IF;
  INSERT INTO pilotage.controle_gestion (user_id, email) VALUES (u, lower(trim(p_email))) ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION pilotage.ajouter_controle_gestion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.ajouter_controle_gestion(text) TO authenticated;

-- ── Journal des changements de paramètres : une ligne par rubrique modifiée (redevance, impôt, charges…)
CREATE TABLE IF NOT EXISTS pilotage.journal_parametres (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  annee     integer NOT NULL,
  rubrique  text NOT NULL,
  avant     jsonb,
  apres     jsonb,
  par       uuid,
  par_email text,
  le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_parametres_annee ON pilotage.journal_parametres (annee, le DESC);

CREATE OR REPLACE FUNCTION pilotage.journaliser_parametres() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text; a jsonb; mail text;
BEGIN
  a := CASE WHEN TG_OP = 'UPDATE' THEN OLD.valeur ELSE '{}'::jsonb END;
  SELECT lower(u.email) INTO mail FROM auth.users u WHERE u.id = auth.uid();
  FOR k IN SELECT DISTINCT x FROM (SELECT jsonb_object_keys(a) AS x UNION SELECT jsonb_object_keys(NEW.valeur)) t LOOP
    IF (a -> k) IS DISTINCT FROM (NEW.valeur -> k) THEN
      INSERT INTO pilotage.journal_parametres (annee, rubrique, avant, apres, par, par_email)
      VALUES (NEW.annee, k, a -> k, NEW.valeur -> k, auth.uid(), mail);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS journal_parametres ON pilotage.parametres_reseau;
CREATE TRIGGER journal_parametres AFTER INSERT OR UPDATE ON pilotage.parametres_reseau
  FOR EACH ROW EXECUTE FUNCTION pilotage.journaliser_parametres();

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['controle_gestion', 'journal_parametres'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- Contrôle de gestion : la liste se lit par ceux qui paramètrent ; seul le Directeur retire un compte (ajout par la fonction)
CREATE POLICY "parametreurs_lecture" ON pilotage.controle_gestion FOR SELECT TO authenticated
  USING ((SELECT pilotage.peut_parametrer()));
CREATE POLICY "directeur_retrait" ON pilotage.controle_gestion FOR DELETE TO authenticated
  USING ((SELECT public.est_directeur()));
GRANT SELECT, DELETE ON pilotage.controle_gestion TO authenticated;

-- Journal : lu par ceux qui paramètrent et par les RR ; écrit seulement par le déclencheur
CREATE POLICY "journal_lecture" ON pilotage.journal_parametres FOR SELECT TO authenticated
  USING ((SELECT pilotage.peut_parametrer()) OR (SELECT public.mon_role()) = 'rr');
GRANT SELECT ON pilotage.journal_parametres TO authenticated;

-- Paramètres réseau : écriture par le Directeur ou le contrôle de gestion ; lecture inchangée (comptes ouverts),
-- plus le contrôle de gestion même sans rôle dans l'app réseau
DROP POLICY IF EXISTS "directeur_ecriture" ON pilotage.parametres_reseau;
DROP POLICY IF EXISTS "parametrage_ecriture" ON pilotage.parametres_reseau;
CREATE POLICY "parametrage_ecriture" ON pilotage.parametres_reseau FOR ALL TO authenticated
  USING ((SELECT pilotage.peut_parametrer())) WITH CHECK ((SELECT pilotage.peut_parametrer()));
DROP POLICY IF EXISTS "parametrage_lecture" ON pilotage.parametres_reseau;
CREATE POLICY "parametrage_lecture" ON pilotage.parametres_reseau FOR SELECT TO authenticated
  USING ((SELECT pilotage.peut_parametrer()));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0021', 'parametrage')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

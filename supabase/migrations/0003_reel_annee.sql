-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — réel de l'année (27/10/2026). Réexécutable.
-- Décisions de Joseph : le CA, la marge et les tickets de l'année en cours (et de l'année précédente) arrivent par les
-- fichiers mensuels de la DSI, ou sont saisis à la main. Saisie par le Directeur, le RR, le Coach ou le franchisé, chacun
-- sur ses magasins.
--
-- 1) reel_mensuel : CA TTC en plus ; écriture ouverte à l'équipe et au franchisé sur leurs magasins.
-- 2) reel_tickets : tickets par mois et univers (un ticket ne se compte pas par famille).
-- 3) codes_caisse : correspondance entre le code magasin de la caisse et le nom du magasin.
-- 4) remplacer_reel(ventes, tickets) : remplace d'un bloc les mois reçus pour chaque magasin (import ou saisie).
-- Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

-- ── 1) Réel par famille
ALTER TABLE pilotage.reel_mensuel ADD COLUMN IF NOT EXISTS ca_ttc numeric;
ALTER TABLE pilotage.reel_mensuel ADD COLUMN IF NOT EXISTS maj_par uuid DEFAULT auth.uid();

-- ── 2) Tickets
CREATE TABLE IF NOT EXISTS pilotage.reel_tickets (
  store_name text NOT NULL CHECK (store_name <> ''),
  mois       date NOT NULL CHECK (extract(day FROM mois) = 1),
  univers    text NOT NULL CHECK (univers IN ('cave', 'bar', 'exterieur')),
  tickets    integer NOT NULL CHECK (tickets >= 0),
  importe_le timestamptz NOT NULL DEFAULT now(),
  maj_par    uuid DEFAULT auth.uid(),
  PRIMARY KEY (store_name, mois, univers)
);

-- ── 3) Codes caisse
CREATE TABLE IF NOT EXISTS pilotage.codes_caisse (
  code       text PRIMARY KEY CHECK (btrim(code) <> ''),
  store_name text NOT NULL UNIQUE CHECK (store_name <> '')
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['reel_mensuel', 'reel_tickets', 'codes_caisse'] LOOP
    EXECUTE format('ALTER TABLE pilotage.%I ENABLE ROW LEVEL SECURITY', t);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('REVOKE ALL ON pilotage.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
  -- Réel et tickets : lus sur les magasins du compte ; écrits par le Directeur partout, par le RR, le Coach et le
  -- franchisé sur leurs magasins
  FOREACH t IN ARRAY ARRAY['reel_mensuel', 'reel_tickets'] LOOP
    EXECUTE format('CREATE POLICY "perimetre_lecture" ON pilotage.%I FOR SELECT TO authenticated USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name])', t);
    EXECUTE format('CREATE POLICY "perimetre_ecriture" ON pilotage.%I FOR ALL TO authenticated '
      'USING ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN (''rr'', ''coach'', ''franchise'') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name])) '
      'WITH CHECK ((SELECT public.est_directeur()) OR ((SELECT public.mon_role()) IN (''rr'', ''coach'', ''franchise'') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.%I TO authenticated', t);
  END LOOP;
END $$;

CREATE POLICY "equipe_lecture" ON pilotage.codes_caisse FOR SELECT TO authenticated
  USING ((SELECT public.mon_role()) IN ('directeur', 'rr', 'coach'));
CREATE POLICY "directeur_ecriture" ON pilotage.codes_caisse FOR ALL TO authenticated
  USING ((SELECT public.est_directeur())) WITH CHECK ((SELECT public.est_directeur()));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.codes_caisse TO authenticated;

-- ── 4) Remplacement d'un bloc. SECURITY INVOKER : les règles ci-dessus s'appliquent ; une ligne hors périmètre fait
-- échouer tout l'appel, rien n'est écrit à moitié.
-- ventes  : [{store_name, mois (AAAA-MM-01), univers, famille, ca_ht, ca_ttc, marge_ht}]
-- tickets : [{store_name, mois, univers, tickets}]
-- Chaque couple magasin et mois présent dans ventes (ou dans tickets) est vidé puis réécrit.
CREATE OR REPLACE FUNCTION pilotage.remplacer_reel(p_ventes jsonb, p_tickets jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n integer := 0;
BEGIN
  IF jsonb_typeof(coalesce(p_ventes, '[]')) <> 'array' OR jsonb_typeof(coalesce(p_tickets, '[]')) <> 'array' THEN
    RAISE EXCEPTION 'format_invalide';
  END IF;
  DELETE FROM pilotage.reel_mensuel r
  USING (SELECT DISTINCT x.store_name, x.mois FROM jsonb_to_recordset(coalesce(p_ventes, '[]')) AS x(store_name text, mois date)) d
  WHERE r.store_name = d.store_name AND r.mois = d.mois;
  INSERT INTO pilotage.reel_mensuel (store_name, mois, univers, famille, ca_ht, ca_ttc, marge_ht)
  SELECT x.store_name, x.mois, x.univers, x.famille, x.ca_ht, x.ca_ttc, x.marge_ht
  FROM jsonb_to_recordset(coalesce(p_ventes, '[]')) AS x(store_name text, mois date, univers text, famille text, ca_ht numeric, ca_ttc numeric, marge_ht numeric);
  GET DIAGNOSTICS n = ROW_COUNT;

  DELETE FROM pilotage.reel_tickets r
  USING (SELECT DISTINCT x.store_name, x.mois FROM jsonb_to_recordset(coalesce(p_tickets, '[]')) AS x(store_name text, mois date)) d
  WHERE r.store_name = d.store_name AND r.mois = d.mois;
  INSERT INTO pilotage.reel_tickets (store_name, mois, univers, tickets)
  SELECT x.store_name, x.mois, x.univers, x.tickets
  FROM jsonb_to_recordset(coalesce(p_tickets, '[]')) AS x(store_name text, mois date, univers text, tickets integer);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION pilotage.remplacer_reel(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.remplacer_reel(jsonb, jsonb) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0003', 'reel_annee')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

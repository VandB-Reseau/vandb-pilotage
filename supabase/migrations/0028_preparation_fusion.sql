-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — préparation de la fusion avec l'app réseau (03/11/2026). Réexécutable.
-- Décisions de Joseph (3/11) : la caisse devient la seule source du CA ; les chiffres saisis dans l'app réseau
-- (public.store_finance) seront retirés après la bascule. Avant, deux contrôles en lecture pour le Directeur et le
-- contrôle de gestion, et un rattachement pour le Directeur :
--   - concordance_ca(annee) : CA et tickets du mois, caisse (pilotage) face à l'app réseau (store_finance) ;
--   - magasins_orphelins() : noms de magasin présents dans le pilotage mais absents de la liste des magasins
--     de l'app réseau (perimetre_equipe), avec le nouveau nom quand l'app réseau l'a renommé (store_renames) ;
--   - renommer_magasin(ancien, nouveau) : Directeur seul ; déplace toutes les lignes du pilotage de l'ancien nom vers
--     le nouveau. Une ligne qui existe déjà sous le nouveau nom (même année, même mois…) n'est pas écrasée : elle
--     reste sous l'ancien nom et est comptée à part.
-- Lit seulement les tables de l'app réseau (store_finance, perimetre_equipe, app_config). Suppose 0001 et 0021.
-- ════════════════════════════════════════════════════════════════

-- CA et tickets par magasin et par mois, des deux côtés ; une ligne dès qu'un des deux côtés a un chiffre
CREATE OR REPLACE FUNCTION pilotage.concordance_ca(p_annee integer)
RETURNS TABLE (store_name text, mois date, ca_caisse numeric, tickets_caisse numeric, ca_reseau numeric, tickets_reseau numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT pilotage.peut_parametrer() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  RETURN QUERY
  WITH caisse AS (
    SELECT r.store_name AS nom, r.mois AS m, sum(r.ca_ht) AS ca FROM pilotage.reel_mensuel r
    WHERE extract(year FROM r.mois) = p_annee GROUP BY r.store_name, r.mois
  ), tickets AS (
    SELECT t.store_name AS nom, t.mois AS m, sum(t.tickets) AS nb FROM pilotage.reel_tickets t
    WHERE extract(year FROM t.mois) = p_annee GROUP BY t.store_name, t.mois
  ), reseau AS (
    SELECT f.store_name AS nom, date_trunc('month', f.month)::date AS m,
      CASE WHEN f.ca_cave IS NULL AND f.ca_bar IS NULL AND f.ca_ext IS NULL THEN NULL
           ELSE coalesce(f.ca_cave, 0) + coalesce(f.ca_bar, 0) + coalesce(f.ca_ext, 0) END AS ca,
      f.freq AS nb
    FROM public.store_finance f WHERE extract(year FROM f.month) = p_annee
  ), cles AS (
    SELECT nom, m FROM caisse UNION SELECT nom, m FROM tickets UNION SELECT nom, m FROM reseau WHERE ca IS NOT NULL OR nb IS NOT NULL
  )
  SELECT k.nom, k.m, c.ca::numeric, t.nb::numeric, r.ca::numeric, r.nb::numeric
  FROM cles k
  LEFT JOIN caisse c ON c.nom = k.nom AND c.m = k.m
  LEFT JOIN tickets t ON t.nom = k.nom AND t.m = k.m
  LEFT JOIN reseau r ON r.nom = k.nom AND r.m = k.m
  ORDER BY k.nom, k.m;
END $$;
REVOKE ALL ON FUNCTION pilotage.concordance_ca(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.concordance_ca(integer) TO authenticated;

-- Tables du pilotage rangées par magasin (colonne store_name)
CREATE OR REPLACE FUNCTION pilotage.tables_par_magasin() RETURNS SETOF text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT c.table_name::text FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
  WHERE c.table_schema = 'pilotage' AND c.column_name = 'store_name'
  ORDER BY 1
$$;
REVOKE ALL ON FUNCTION pilotage.tables_par_magasin() FROM PUBLIC, anon, authenticated;

-- Noms de magasin du pilotage inconnus de l'app réseau, avec leur nombre de lignes et le nouveau nom s'il est connu
CREATE OR REPLACE FUNCTION pilotage.magasins_orphelins() RETURNS TABLE (store_name text, lignes bigint, nouveau_nom text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_union text; v_renames jsonb;
BEGIN
  IF NOT pilotage.peut_parametrer() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  SELECT string_agg(format('SELECT store_name FROM pilotage.%I', t), ' UNION ALL ') INTO v_union FROM pilotage.tables_par_magasin() t;
  v_renames := coalesce((SELECT CASE WHEN jsonb_typeof(public.json_sur(c.value)) = 'object' THEN public.json_sur(c.value) END
    FROM public.app_config c WHERE c.key = 'store_renames'), '{}'::jsonb);
  RETURN QUERY EXECUTE format(
    'SELECT n.store_name, count(*)::bigint,
       CASE WHEN EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.store_name = $1 ->> n.store_name) THEN $1 ->> n.store_name END
     FROM (%s) n
     WHERE NOT EXISTS (SELECT 1 FROM public.perimetre_equipe p WHERE p.store_name = n.store_name)
     GROUP BY n.store_name ORDER BY n.store_name', v_union) USING v_renames;
END $$;
REVOKE ALL ON FUNCTION pilotage.magasins_orphelins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.magasins_orphelins() TO authenticated;

-- Déplace les lignes d'un magasin vers son nouveau nom ; renvoie {deplacees, restees}
CREATE OR REPLACE FUNCTION pilotage.renommer_magasin(p_ancien text, p_nouveau text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text; v_cles text; v_n bigint; v_deplacees bigint := 0; v_restees bigint := 0;
BEGIN
  IF NOT public.est_directeur() THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  p_ancien := btrim(coalesce(p_ancien, '')); p_nouveau := btrim(coalesce(p_nouveau, ''));
  IF p_ancien = '' OR p_nouveau = '' OR p_ancien = p_nouveau THEN RAISE EXCEPTION 'noms_invalides'; END IF;
  FOR t IN SELECT pilotage.tables_par_magasin() LOOP
    -- Autres colonnes de la clé primaire (année, mois, univers…) : une ligne déjà présente sous le nouveau nom l'emporte
    SELECT string_agg(format('d.%1$I = s.%1$I', a.attname), ' AND ') INTO v_cles
    FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = format('pilotage.%I', t)::regclass AND i.indisprimary AND a.attname <> 'store_name';
    IF EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
               WHERE i.indrelid = format('pilotage.%I', t)::regclass AND i.indisprimary AND a.attname = 'store_name') THEN
      EXECUTE format('UPDATE pilotage.%1$I s SET store_name = $2 WHERE s.store_name = $1
        AND NOT EXISTS (SELECT 1 FROM pilotage.%1$I d WHERE d.store_name = $2 %2$s)', t,
        CASE WHEN v_cles IS NULL THEN '' ELSE 'AND ' || v_cles END) USING p_ancien, p_nouveau;
    ELSE
      EXECUTE format('UPDATE pilotage.%I SET store_name = $2 WHERE store_name = $1', t) USING p_ancien, p_nouveau;
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_deplacees := v_deplacees + v_n;
    EXECUTE format('SELECT count(*) FROM pilotage.%I WHERE store_name = $1', t) INTO v_n USING p_ancien;
    v_restees := v_restees + v_n;
  END LOOP;
  RETURN jsonb_build_object('deplacees', v_deplacees, 'restees', v_restees);
END $$;
REVOKE ALL ON FUNCTION pilotage.renommer_magasin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.renommer_magasin(text, text) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0028', 'preparation_fusion')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

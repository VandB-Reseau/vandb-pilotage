-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — date d'ouverture lue dans la fiche magasin de l'app réseau (Joseph, 03/11/2026). Réexécutable.
-- La date n'est plus à saisir dans le pilotage : elle vient de la fiche magasin de l'app réseau (surcharge
-- store_overrides.open_date, sinon la liste des magasins app_config 'store_adds', après renommage 'store_renames').
-- Les dates « inconnues » de l'app réseau (1er janvier 2020 et 2027) sont écartées : la saisie du pilotage
-- (pilotage.ouvertures, 0014) reste le secours pour ces magasins. Lecture seule, magasins du compte seulement.
-- Ne touche à aucune table de l'app réseau. Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

-- Date lue sans jamais faire échouer la lecture : un texte qui n'est pas une date donne NULL
CREATE OR REPLACE FUNCTION pilotage.date_sure(t text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF t IS NULL OR t !~ '^\d{4}-\d{2}-\d{2}' THEN RETURN NULL; END IF;
  RETURN substr(t, 1, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pilotage.date_sure(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.date_sure(text) TO authenticated;

-- Une ligne par magasin du compte dont l'app réseau connaît la date d'ouverture, ramenée au 1er du mois
CREATE OR REPLACE FUNCTION pilotage.ouvertures_reseau() RETURNS TABLE (store_name text, ouverture date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH cfg AS (
    SELECT c.key, public.json_sur(c.value) AS v FROM public.app_config c WHERE c.key IN ('store_adds', 'store_renames')
  ), renommages AS (
    SELECT coalesce((SELECT CASE WHEN jsonb_typeof(v) = 'object' THEN v END FROM cfg WHERE key = 'store_renames'), '{}'::jsonb) AS r
  ), liste AS (
    SELECT coalesce(nullif((SELECT r FROM renommages) ->> (e ->> 'n'), ''), e ->> 'n') AS nom, e ->> 'open' AS o
    FROM cfg, jsonb_array_elements(CASE WHEN jsonb_typeof(cfg.v) = 'array' THEN cfg.v ELSE '[]'::jsonb END) e
    WHERE cfg.key = 'store_adds'
  ), dates AS (
    SELECT coalesce(s.store_name, l.nom) AS nom, pilotage.date_sure(coalesce(nullif(trim(s.open_date), ''), l.o)) AS d
    FROM liste l FULL JOIN public.store_overrides s ON s.store_name = l.nom
  )
  SELECT DISTINCT ON (nom) nom, date_trunc('month', d)::date
  FROM dates
  WHERE d IS NOT NULL AND d NOT IN ('2020-01-01', '2027-01-01') AND coalesce(nom, '') <> ''
    AND (SELECT pilotage.mes_magasins()) @> ARRAY[nom]
  ORDER BY nom
$$;
REVOKE ALL ON FUNCTION pilotage.ouvertures_reseau() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.ouvertures_reseau() TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0024', 'ouvertures_reseau')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

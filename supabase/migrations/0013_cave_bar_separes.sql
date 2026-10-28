-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — Cave et Bar séparés dans la vue réseau (lot 22, 28/10/2026). Réexécutable.
-- reel_du_compte(année) garde tout ce que donnait 0007 et ajoute, par magasin et par mois, le CA TTC et les tickets
-- de la Cave et du Bar ('ttc_cave', 'ttc_bar', 'tickets_cave', 'tickets_bar') : deux clientèles, deux paniers moyens.
-- Ne crée ni table ni règle d'accès ; mêmes droits d'exécution qu'avant. Suppose 0007_filtre_rr.sql.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pilotage.reel_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mes AS (SELECT unnest(pilotage.mes_magasins()) AS m),
  ventes AS (
    SELECT r.store_name AS magasin, r.mois,
      sum(r.ca_ht) AS ca, coalesce(sum(r.marge_ht), 0) AS marge,
      coalesce(sum(r.ca_ht) FILTER (WHERE r.marge_ht IS NOT NULL), 0) AS ca_marge, coalesce(sum(r.ca_ttc), 0) AS ttc,
      coalesce(sum(r.ca_ttc) FILTER (WHERE r.univers = 'cave'), 0) AS ttc_cave,
      coalesce(sum(r.ca_ttc) FILTER (WHERE r.univers = 'bar'), 0) AS ttc_bar
    FROM pilotage.reel_mensuel r JOIN mes ON mes.m = r.store_name
    WHERE r.mois >= make_date(p_annee - 1, 1, 1) AND r.mois < make_date(p_annee + 1, 1, 1)
    GROUP BY r.store_name, r.mois),
  tickets AS (
    SELECT t.store_name AS magasin, t.mois, sum(t.tickets) AS tickets,
      coalesce(sum(t.tickets) FILTER (WHERE t.univers = 'cave'), 0) AS tickets_cave,
      coalesce(sum(t.tickets) FILTER (WHERE t.univers = 'bar'), 0) AS tickets_bar
    FROM pilotage.reel_tickets t JOIN mes ON mes.m = t.store_name
    WHERE t.mois >= make_date(p_annee - 1, 1, 1) AND t.mois < make_date(p_annee + 1, 1, 1)
    GROUP BY t.store_name, t.mois),
  fiches_rr AS (
    SELECT d->>'id' AS id, nullif(trim(d->>'name'), '') AS nom
    FROM (SELECT public.json_sur(c.value)->'drs' AS drs FROM public.app_config c WHERE c.key = 'drs_data') x,
      jsonb_array_elements(CASE WHEN jsonb_typeof(x.drs) = 'array' THEN x.drs ELSE '[]'::jsonb END) d
    WHERE public.mon_role() = 'directeur')
  SELECT jsonb_build_object(
    'mois', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'magasin', coalesce(v.magasin, t.magasin), 'mois', to_char(coalesce(v.mois, t.mois), 'YYYY-MM'),
        'ca', coalesce(v.ca, 0), 'marge', coalesce(v.marge, 0), 'ca_marge', coalesce(v.ca_marge, 0), 'ttc', coalesce(v.ttc, 0),
        'tickets', coalesce(t.tickets, 0),
        'ttc_cave', coalesce(v.ttc_cave, 0), 'ttc_bar', coalesce(v.ttc_bar, 0),
        'tickets_cave', coalesce(t.tickets_cave, 0), 'tickets_bar', coalesce(t.tickets_bar, 0)))
      FROM ventes v FULL JOIN tickets t ON t.magasin = v.magasin AND t.mois = v.mois), '[]'::jsonb),
    'coachs', coalesce((SELECT jsonb_object_agg(p.store_name, p.coach)
      FROM public.perimetre_equipe p JOIN mes ON mes.m = p.store_name
      WHERE public.mon_role() IN ('directeur', 'rr') AND p.coach IS NOT NULL), '{}'::jsonb),
    'rrs', coalesce((SELECT jsonb_object_agg(s.store_name, s.noms) FROM (
        SELECT p.store_name, jsonb_agg(DISTINCT f.nom) AS noms
        FROM public.perimetre_equipe p JOIN mes ON mes.m = p.store_name
          CROSS JOIN LATERAL unnest(p.rrs) AS r(id) JOIN fiches_rr f ON f.id = r.id
        WHERE public.mon_role() = 'directeur' AND f.nom IS NOT NULL
        GROUP BY p.store_name) s), '{}'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION pilotage.reel_du_compte(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.reel_du_compte(integer) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0013', 'cave_bar_separes')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — réel de tous les magasins du compte, pour la vue réseau (27/10/2026). Réexécutable.
-- reel_du_compte(année) : CA, marge, CA TTC et tickets par magasin et par mois, pour l'année demandée et la précédente,
-- totalisés dans la base (quelques milliers de lignes au lieu de dizaines de milliers). Mêmes magasins que les règles
-- de lecture du réel (mes_magasins) ; le Coach de chaque magasin n'est donné qu'au Directeur et au RR, pour filtrer.
-- Ne crée ni table ni règle d'accès. Suppose 0001_socle_pilotage.sql et 0003_reel_annee.sql.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pilotage.reel_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mes AS (SELECT unnest(pilotage.mes_magasins()) AS m),
  ventes AS (
    SELECT r.store_name AS magasin, r.mois,
      sum(r.ca_ht) AS ca, coalesce(sum(r.marge_ht), 0) AS marge,
      coalesce(sum(r.ca_ht) FILTER (WHERE r.marge_ht IS NOT NULL), 0) AS ca_marge, coalesce(sum(r.ca_ttc), 0) AS ttc
    FROM pilotage.reel_mensuel r JOIN mes ON mes.m = r.store_name
    WHERE r.mois >= make_date(p_annee - 1, 1, 1) AND r.mois < make_date(p_annee + 1, 1, 1)
    GROUP BY r.store_name, r.mois),
  tickets AS (
    SELECT t.store_name AS magasin, t.mois, sum(t.tickets) AS tickets
    FROM pilotage.reel_tickets t JOIN mes ON mes.m = t.store_name
    WHERE t.mois >= make_date(p_annee - 1, 1, 1) AND t.mois < make_date(p_annee + 1, 1, 1)
    GROUP BY t.store_name, t.mois)
  SELECT jsonb_build_object(
    'mois', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'magasin', coalesce(v.magasin, t.magasin), 'mois', to_char(coalesce(v.mois, t.mois), 'YYYY-MM'),
        'ca', coalesce(v.ca, 0), 'marge', coalesce(v.marge, 0), 'ca_marge', coalesce(v.ca_marge, 0), 'ttc', coalesce(v.ttc, 0),
        'tickets', coalesce(t.tickets, 0)))
      FROM ventes v FULL JOIN tickets t ON t.magasin = v.magasin AND t.mois = v.mois), '[]'::jsonb),
    'coachs', coalesce((SELECT jsonb_object_agg(p.store_name, p.coach)
      FROM public.perimetre_equipe p JOIN mes ON mes.m = p.store_name
      WHERE public.mon_role() IN ('directeur', 'rr') AND p.coach IS NOT NULL), '{}'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION pilotage.reel_du_compte(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.reel_du_compte(integer) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0006', 'suivi_reseau')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

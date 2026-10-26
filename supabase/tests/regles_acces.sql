-- Vérifie les règles d'accès du pilotage après les migrations, avec des données fictives.
-- Chaque contrôle qui échoue arrête le script avec un message clair.
\set ON_ERROR_STOP 1

-- ── Comptes et périmètre fictifs
INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000d', 'directeur@exemple.fr', '{"role":"directeur"}'),
  ('00000000-0000-0000-0000-00000000000c', 'coach@exemple.fr',     '{"role":"coach","coach":"Coach Nord"}'),
  ('00000000-0000-0000-0000-00000000000e', 'rr@exemple.fr',        '{"role":"rr","rr":"rr1"}'),
  ('00000000-0000-0000-0000-00000000000f', 'franchise@exemple.fr', '{"role":"franchise"}'),
  ('00000000-0000-0000-0000-000000000000', 'sansrole@exemple.fr',  '{}')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.acces_franchises (user_id, email, franchise, magasins)
VALUES ('00000000-0000-0000-0000-00000000000f', 'franchise@exemple.fr', 'Franchisé Test', '{Lille}') ON CONFLICT DO NOTHING;
INSERT INTO public.perimetre_equipe (store_name, coach, rrs) VALUES
  ('Lille', 'Coach Nord', '{rr1}'), ('Arras', 'Coach Sud', '{rr1}'), ('Nice', 'Coach Sud', '{}') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.refuse(appel text) RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE appel; RETURN 0;
EXCEPTION WHEN others THEN RETURN 1;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.refuse(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION pg_temp.attendre(libelle text, obtenu bigint, attendu bigint) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF obtenu IS DISTINCT FROM attendu THEN RAISE EXCEPTION 'ÉCHEC : % (obtenu %, attendu %)', libelle, obtenu, attendu; END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.attendre(text, bigint, bigint) TO authenticated, anon;

-- ── Directeur : voit tout, propose les budgets, tient les paramètres et le réel
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
INSERT INTO pilotage.budgets (store_name, annee, proposition, hypotheses) VALUES
  ('Lille', 2027, '{"v":1}', '{"v":1}'), ('Arras', 2027, '{"v":1}', '{"v":1}'), ('Nice', 2027, '{"v":1}', '{"v":1}')
ON CONFLICT DO NOTHING;
INSERT INTO pilotage.reel_mensuel (store_name, mois, univers, famille, ca_ht) VALUES
  ('Lille', '2026-09-01', 'cave', 'Bière', 1), ('Nice', '2026-09-01', 'bar', 'Fût', 1) ON CONFLICT DO NOTHING;
SELECT pg_temp.attendre('Directeur : tous les magasins', (SELECT cardinality(pilotage.mes_magasins())), 3);
SELECT pg_temp.attendre('Directeur : tous les budgets', (SELECT count(*) FROM pilotage.budgets), 3);
SELECT pg_temp.attendre('Directeur : tableau des magasins', (SELECT jsonb_array_length(pilotage.magasins_du_compte(2027))), 3);
SELECT pg_temp.attendre('Directeur : lit le journal', (SELECT count(*) FROM pilotage.journal_migrations), 1);
WITH m AS (UPDATE pilotage.parametres_reseau SET valeur = valeur WHERE annee = 2027 RETURNING 1)
SELECT pg_temp.attendre('Directeur : modifie les paramètres', (SELECT count(*) FROM m), 1);

-- ── Coach : lit les budgets et le réel de ses magasins, n'écrit rien
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : budgets de ses magasins', (SELECT count(*) FROM pilotage.budgets), 1);
SELECT pg_temp.attendre('Coach : réel de ses magasins', (SELECT count(*) FROM pilotage.reel_mensuel), 1);
SELECT pg_temp.attendre('Coach : tableau limité à ses magasins', (SELECT jsonb_array_length(pilotage.magasins_du_compte(2027))), 1);
SELECT pg_temp.attendre('Coach : lit les paramètres', (SELECT count(*) FROM pilotage.parametres_reseau), 1);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{"v":2}' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas un budget', (SELECT count(*) FROM m), 0);
WITH m AS (UPDATE pilotage.parametres_reseau SET valeur = '{}' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les paramètres', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : ne crée pas de budget', pg_temp.refuse('INSERT INTO pilotage.budgets (store_name, annee, proposition, hypotheses) VALUES (''Lille'', 2028, ''{}'', ''{}'')'), 1);
SELECT pg_temp.attendre('Coach : n''importe pas de réel', pg_temp.refuse('INSERT INTO pilotage.reel_mensuel (store_name, mois, univers, famille) VALUES (''Lille'', ''2026-10-01'', ''cave'', ''Vin'')'), 1);
SELECT pg_temp.attendre('Coach : pas de journal', (SELECT count(*) FROM pilotage.journal_migrations), 0);

-- ── RR : les magasins qu'il suit
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT pg_temp.attendre('RR : budgets des magasins suivis', (SELECT count(*) FROM pilotage.budgets), 2);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{"v":2}' RETURNING 1)
SELECT pg_temp.attendre('RR : ne modifie pas un budget', (SELECT count(*) FROM m), 0);

-- ── Franchisé : son magasin ; modifie ses hypothèses, jamais la proposition ni la validation
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : son budget seulement', (SELECT count(*) FROM pilotage.budgets), 1);
SELECT pg_temp.attendre('Franchisé : son réel seulement', (SELECT count(*) FROM pilotage.reel_mensuel), 1);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{"v":2}' WHERE store_name = 'Lille' RETURNING statut)
SELECT pg_temp.attendre('Franchisé : sa modification met le budget en discussion', (SELECT count(*) FROM m WHERE statut = 'en_discussion'), 1);
SELECT pg_temp.attendre('Franchisé : ne valide pas', (SELECT count(*) FROM pilotage.budgets WHERE statut = 'valide'), 0);
SELECT pg_temp.attendre('Franchisé : ne change pas la proposition', pg_temp.refuse('UPDATE pilotage.budgets SET proposition = ''{"v":9}'' WHERE store_name = ''Lille'''), 1);
WITH m AS (UPDATE pilotage.budgets SET statut = 'valide' WHERE store_name = 'Lille' RETURNING statut)
SELECT pg_temp.attendre('Franchisé : « valide » redevient « en discussion »', (SELECT count(*) FROM m WHERE statut = 'en_discussion'), 1);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{}' WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : rien sur un autre magasin', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Franchisé : ne crée pas de budget', pg_temp.refuse('INSERT INTO pilotage.budgets (store_name, annee, proposition, hypotheses) VALUES (''Lille'', 2028, ''{}'', ''{}'')'), 1);
WITH m AS (DELETE FROM pilotage.budgets RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne supprime pas', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Franchisé : lit les paramètres', (SELECT count(*) FROM pilotage.parametres_reseau), 1);

-- ── Directeur : valide ; le budget validé est figé pour le franchisé
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
WITH m AS (UPDATE pilotage.budgets SET statut = 'valide' WHERE store_name = 'Lille' RETURNING valide_le)
SELECT pg_temp.attendre('Directeur : valide et date la validation', (SELECT count(*) FROM m WHERE valide_le IS NOT NULL), 1);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : budget validé figé', pg_temp.refuse('UPDATE pilotage.budgets SET hypotheses = ''{"v":3}'' WHERE store_name = ''Lille'''), 1);

-- ── Compte sans rôle et visiteur non connecté : rien
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';
SELECT pg_temp.attendre('Sans rôle : aucun budget', (SELECT count(*) FROM pilotage.budgets), 0);
SELECT pg_temp.attendre('Sans rôle : aucun paramètre', (SELECT count(*) FROM pilotage.parametres_reseau), 0);
SELECT pg_temp.attendre('Sans rôle : aucun magasin', (SELECT cardinality(pilotage.mes_magasins())), 0);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.attendre('Visiteur : aucun accès aux budgets', pg_temp.refuse('SELECT count(*) FROM pilotage.budgets'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux fonctions', pg_temp.refuse('SELECT pilotage.mes_magasins()'), 1);
RESET ROLE;

-- ── Aucune règle ouverte à tout compte connecté
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v FROM pg_policies
  WHERE schemaname = 'pilotage' AND (coalesce(qual, '') IN ('true', '') AND cmd <> 'INSERT' OR coalesce(with_check, '') = 'true');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'Règles ouvertes à tout compte connecté : %', v; END IF;
END $$;

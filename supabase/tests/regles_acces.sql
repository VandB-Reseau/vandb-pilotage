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
  ('Lille', 'Coach Nord', '{rr1}'), ('Arras', 'Coach Sud', '{rr1,rr2}'), ('Nice', 'Coach Sud', '{rr3}') ON CONFLICT DO NOTHING;
-- Fiche des RR de l'app réseau : rr3 sans nom ne sort pas
INSERT INTO public.app_config (key, value) VALUES
  ('drs_data', '{"drs":[{"id":"rr1","name":"RR Nord"},{"id":"rr2","name":"RR Est"},{"id":"rr3","name":" "}]}') ON CONFLICT (key) DO NOTHING;

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
SELECT pg_temp.attendre('Directeur : lit le journal', (SELECT count(*) FROM pilotage.journal_migrations), 17);
-- Frais : le Directeur saisit partout
INSERT INTO pilotage.frais (store_name, code, libelle, rubrique, annuel) VALUES ('Lille', 'loyer', 'Locations immobilières', 'immobilier', 60000), ('Nice', 'loyer', 'Locations immobilières', 'immobilier', 40000);
SELECT pg_temp.attendre('Directeur : tous les frais', (SELECT count(*) FROM pilotage.frais), 2);
-- Quadrimestres : le Directeur saisit partout
INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre, achats, charges_externes, impots_taxes, personnel, tresorerie) VALUES
  ('Lille', 2026, 1, 100000, 30000, 2000, 50000, 15000), ('Nice', 2026, 1, 80000, 20000, 1000, 40000, -5000);
SELECT pg_temp.attendre('Directeur : tous les quadrimestres', (SELECT count(*) FROM pilotage.quadrimestres), 2);
SELECT pg_temp.attendre('Quadrimestres : un quatrième quadrimestre est refusé', pg_temp.refuse('INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre) VALUES (''Lille'', 2026, 4)'), 1);
-- Parts de l'année réalisées : le Directeur saisit partout
INSERT INTO pilotage.parts_realisees (store_name, annee, univers, part) VALUES ('Lille', 2026, 'cave', 0.626), ('Nice', 2026, 'bar', 0.6);
SELECT pg_temp.attendre('Directeur : toutes les parts réalisées', (SELECT count(*) FROM pilotage.parts_realisees), 2);
INSERT INTO pilotage.correspondances_fec (store_name, compte, rubrique) VALUES ('Lille', '658000', 'charges_externes'), ('Nice', '658100', 'hors_ebe');
SELECT pg_temp.attendre('Directeur : toutes les correspondances du FEC', (SELECT count(*) FROM pilotage.correspondances_fec), 2);
SELECT pg_temp.attendre('Correspondances du FEC : seuls les comptes de charges', pg_temp.refuse('INSERT INTO pilotage.correspondances_fec (store_name, compte, rubrique) VALUES (''Lille'', ''401000'', ''achats'')'), 1);
SELECT pg_temp.attendre('Parts réalisées : une part au-delà de 100 % est refusée', pg_temp.refuse('INSERT INTO pilotage.parts_realisees (store_name, annee, univers, part) VALUES (''Lille'', 2026, ''bar'', 1.2)'), 1);
SELECT pg_temp.attendre('Quadrimestres : des achats négatifs sont refusés', pg_temp.refuse('INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre, achats) VALUES (''Lille'', 2026, 2, -1)'), 1);
SELECT pg_temp.attendre('Frais : montant et part du CA ensemble refusés', pg_temp.refuse('INSERT INTO pilotage.frais (store_name, code, libelle, rubrique, annuel, taux_ca) VALUES (''Lille'', ''energie'', ''Énergie'', ''energies'', 1, 0.01)'), 1);
-- Équipe : le Directeur saisit partout
INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES
  ('Lille', 'Vendeur 1', 'employe', 35, 1823.03), ('Nice', 'Vendeur 1', 'employe', 24, 1300);
SELECT pg_temp.attendre('Directeur : toutes les équipes', (SELECT count(*) FROM pilotage.equipe), 2);
SELECT pg_temp.attendre('Équipe : une catégorie inconnue est refusée', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES (''Lille'', ''X'', ''stagiaire'', 35, 1)'), 1);
SELECT pg_temp.attendre('Équipe : une sortie avant l''entrée est refusée', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel, entree, sortie) VALUES (''Lille'', ''X'', ''employe'', 35, 1, ''2026-05-01'', ''2026-03-01'')'), 1);
-- Réel de l'année : codes caisse et import d'un bloc (ventes et tickets)
INSERT INTO pilotage.codes_caisse (code, store_name) VALUES ('0101', 'Lille'), ('0102', 'Nice') ON CONFLICT DO NOTHING;
SELECT pg_temp.attendre('Directeur : importe le réel de tous les magasins', pilotage.remplacer_reel(
  '[{"store_name":"Lille","mois":"2026-08-01","univers":"cave","famille":"Bière","ca_ht":100,"ca_ttc":120,"marge_ht":36},
    {"store_name":"Nice","mois":"2026-08-01","univers":"bar","famille":"Fût","ca_ht":50,"ca_ttc":60,"marge_ht":37}]',
  '[{"store_name":"Lille","mois":"2026-08-01","univers":"cave","tickets":5}]')::bigint, 2);
SELECT pg_temp.attendre('Directeur : réimporter un mois le remplace', pilotage.remplacer_reel(
  '[{"store_name":"Lille","mois":"2026-08-01","univers":"cave","famille":"Vin","ca_ht":80,"ca_ttc":96,"marge_ht":24}]', '[]')::bigint, 1);
SELECT pg_temp.attendre('Directeur : le mois remplacé ne garde que la nouvelle ligne', (SELECT count(*) FROM pilotage.reel_mensuel WHERE store_name = 'Lille' AND mois = '2026-08-01'), 1);
-- Réel du compte pour la vue réseau : totaux par magasin et par mois, Coach de chaque magasin
CREATE OR REPLACE FUNCTION pg_temp.reel_magasins(a integer) RETURNS text LANGUAGE sql AS $f$
  SELECT coalesce(string_agg(DISTINCT x->>'magasin', ',' ORDER BY x->>'magasin'), '') FROM jsonb_array_elements(pilotage.reel_du_compte(a)->'mois') x
$f$;
GRANT EXECUTE ON FUNCTION pg_temp.reel_magasins(integer) TO authenticated, anon;
SELECT pg_temp.attendre('Directeur : réel de tous les magasins', (SELECT count(*) FROM regexp_split_to_table(pg_temp.reel_magasins(2026), ',')), 2);
SELECT pg_temp.attendre('Directeur : réel du compte totalisé par mois', (SELECT count(*) FROM jsonb_array_elements(pilotage.reel_du_compte(2026)->'mois') x
  WHERE x->>'magasin' = 'Lille' AND x->>'mois' = '2026-08' AND (x->>'ca')::numeric = 80 AND (x->>'marge')::numeric = 24 AND (x->>'ca_marge')::numeric = 80), 1);
SELECT pg_temp.attendre('Directeur : Cave et Bar séparés dans le réel du compte', (SELECT count(*) FROM jsonb_array_elements(pilotage.reel_du_compte(2026)->'mois') x
  WHERE x->>'magasin' = 'Lille' AND x->>'mois' = '2026-08' AND (x->>'ttc_cave')::numeric = 96 AND (x->>'ttc_bar')::numeric = 0 AND x ? 'tickets_cave'), 1);
SELECT pg_temp.attendre('Directeur : réel de l''année et de la précédente seulement', jsonb_array_length(pilotage.reel_du_compte(2030)->'mois'), 0);
SELECT pg_temp.attendre('Directeur : Coach de chaque magasin', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'coachs')), 3);
SELECT pg_temp.attendre('Directeur : RR des magasins qui en ont un nommé', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'rrs')), 2);
SELECT pg_temp.attendre('Directeur : noms des RR d''un magasin suivi par deux', (SELECT ((pilotage.reel_du_compte(2026)->'rrs'->'Arras') = '["RR Est", "RR Nord"]'::jsonb)::int), 1);
-- Hypothèses par niveaux : groupes, cibles du réseau et du groupe, base du magasin
INSERT INTO pilotage.groupes (nom) VALUES ('Centre-ville'), ('Zone commerciale') ON CONFLICT DO NOTHING;
INSERT INTO pilotage.groupe_magasins (store_name, groupe_id) SELECT 'Lille', id FROM pilotage.groupes WHERE nom = 'Centre-ville' ON CONFLICT DO NOTHING;
INSERT INTO pilotage.cibles_reseau (annee, valeur) VALUES (2027, '{"hausseSalaires":0.02}') ON CONFLICT DO NOTHING;
INSERT INTO pilotage.cibles_groupe (groupe_id, annee, valeur) SELECT id, 2027, '{"inflationFrais":0.03}' FROM pilotage.groupes ON CONFLICT DO NOTHING;
WITH m AS (UPDATE pilotage.budgets SET base = '{"b":1}' RETURNING 1)
SELECT pg_temp.attendre('Directeur : pose la base des magasins', (SELECT count(*) FROM m), 3);
SELECT pg_temp.attendre('Directeur : une version par création et par changement de base', (SELECT count(*) FROM pilotage.versions_budget), 6);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = hypotheses RETURNING 1) SELECT count(*) FROM m;
SELECT pg_temp.attendre('Directeur : pas de version sans changement de statut, de base ou d''ajustements', (SELECT count(*) FROM pilotage.versions_budget), 6);
SELECT pg_temp.attendre('Directeur : n''écrit pas de version à la main', pg_temp.refuse('INSERT INTO pilotage.versions_budget (store_name, annee, statut) VALUES (''Lille'', 2027, ''valide'')'), 1);
INSERT INTO pilotage.echanges_budget (store_name, annee, sujet, texte, auteur_role, auteur_nom) VALUES
  ('Lille', 2027, 'ca', 'Proposition : +3 % sur la Cave.', 'franchise', 'Usurpé'), ('Nice', 2027, 'general', 'Budget proposé.', NULL, NULL);
SELECT pg_temp.attendre('Directeur : rôle posé par la base, pas par l''app', (SELECT count(*) FROM pilotage.echanges_budget WHERE auteur_role = 'directeur' AND auteur_nom IS NULL), 2);
SELECT pg_temp.attendre('Échanges : sujet inconnu refusé', pg_temp.refuse('INSERT INTO pilotage.echanges_budget (store_name, annee, sujet, texte) VALUES (''Lille'', 2027, ''autre'', ''x'')'), 1);
SELECT pg_temp.attendre('Échanges : message vide refusé', pg_temp.refuse('INSERT INTO pilotage.echanges_budget (store_name, annee, texte) VALUES (''Lille'', 2027, ''  '')'), 1);
INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee, depart, mois_depart, cree_par_role) VALUES
  ('Lille', 'ca', 'Relancer la vente additionnelle en caisse', 'franchise', 2026, -0.08, 8, 'franchise'),
  ('Nice', 'marge', 'Revoir les prix du fût', 'coach', 2026, -0.015, 8, NULL);
SELECT pg_temp.attendre('Directeur : crée les actions, auteur posé par la base', (SELECT count(*) FROM pilotage.actions WHERE cree_par_role = 'directeur'), 2);
SELECT pg_temp.attendre('Actions : type d''alerte inconnu refusé (0016 ajoute tickets et panier)', pg_temp.refuse('INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee) VALUES (''Lille'', ''meteo'', ''x'', ''franchise'', 2026)'), 1);
SELECT pg_temp.attendre('Actions : responsable inconnu refusé', pg_temp.refuse('INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee) VALUES (''Lille'', ''ca'', ''x'', ''voisin'', 2026)'), 1);
SELECT pg_temp.attendre('Directeur : tous les groupes avec leurs cibles', (SELECT jsonb_array_length(pilotage.budgets_du_compte(2027)->'groupes')), 2);
SELECT pg_temp.attendre('Directeur : budgets du compte', (SELECT jsonb_array_length(pilotage.budgets_du_compte(2027)->'magasins')), 3);
WITH m AS (UPDATE pilotage.parametres_reseau SET valeur = valeur WHERE annee = 2027 RETURNING 1)
SELECT pg_temp.attendre('Directeur : modifie les paramètres', (SELECT count(*) FROM m), 1);
-- Dates d'ouverture : le Directeur les tient, le 1er du mois
INSERT INTO pilotage.ouvertures (store_name, ouverture) VALUES ('Lille', '2024-03-01'), ('Nice', '2025-11-01') ON CONFLICT (store_name) DO UPDATE SET ouverture = EXCLUDED.ouverture;
SELECT pg_temp.attendre('Directeur : toutes les dates d''ouverture', (SELECT count(*) FROM pilotage.ouvertures), 2);
SELECT pg_temp.attendre('Ouvertures : un autre jour que le 1er est refusé', pg_temp.refuse('INSERT INTO pilotage.ouvertures (store_name, ouverture) VALUES (''Arras'', ''2025-05-12'')'), 1);
-- Versions nommées (lot 26) : le Directeur en enregistre partout, auteur posé par la base
INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base, ajustements, auteur_role) VALUES
  ('Lille', 2027, ' Prudente ', '{"v":1}', '{}', 'franchise'), ('Nice', 2027, 'Ambitieuse', '{"v":1}', '{"hausseSalaires":0.02}', NULL);
SELECT pg_temp.attendre('Directeur : versions nommées à son rôle, nom nettoyé', (SELECT count(*) FROM pilotage.versions_nommees WHERE auteur_role = 'directeur' AND nom IN ('Prudente', 'Ambitieuse')), 2);
SELECT pg_temp.attendre('Versions nommées : nom vide refusé', pg_temp.refuse('INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base) VALUES (''Lille'', 2027, ''  '', ''{}'')'), 1);
-- Équipe : heures au mois et primes d'équipe (lot 26)
INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel, primes, heures_saisie, enveloppe) VALUES
  ('Lille', 'Primes d''équipe', 'employe', 0, 0, '[{"mois":12,"montant":2000}]', 'semaine', true);
SELECT pg_temp.attendre('Équipe : unité d''heures inconnue refusée', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel, heures_saisie) VALUES (''Lille'', ''X'', ''employe'', 35, 1, ''jour'')'), 1);

-- ── Coach : lit les budgets et le réel de ses magasins, n'écrit rien
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
SELECT pg_temp.attendre('Coach : budgets de ses magasins', (SELECT count(*) FROM pilotage.budgets), 1);
SELECT pg_temp.attendre('Coach : échanges de ses magasins seulement', (SELECT count(*) FROM pilotage.echanges_budget), 1);
SELECT pg_temp.attendre('Coach : versions de ses magasins seulement', (SELECT count(*) FROM pilotage.versions_budget WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.echanges_budget (store_name, annee, sujet, texte) VALUES ('Lille', 2027, 'personnel', 'Un vendeur de plus en décembre ?');
SELECT pg_temp.attendre('Coach : son nom sur son message', (SELECT count(*) FROM pilotage.echanges_budget WHERE auteur_role = 'coach' AND auteur_nom = 'Coach Nord'), 1);
SELECT pg_temp.attendre('Coach : pas de message hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.echanges_budget (store_name, annee, texte) VALUES (''Nice'', 2027, ''x'')'), 1);
WITH m AS (DELETE FROM pilotage.echanges_budget WHERE auteur_role = 'directeur' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne retire pas le message d''un autre', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : actions de ses magasins seulement', (SELECT count(*) FROM pilotage.actions WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee) VALUES ('Lille', 'reel', 'Saisir le réel de septembre', 'franchise', 2026);
SELECT pg_temp.attendre('Coach : pas d''action hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee) VALUES (''Nice'', ''ca'', ''x'', ''coach'', 2026)'), 1);
WITH m AS (UPDATE pilotage.actions SET echeance = '2026-11-15' WHERE store_name = 'Lille' RETURNING 1)
SELECT pg_temp.attendre('Coach : modifie les actions de ses magasins', (SELECT count(*) FROM m), 2);
SELECT pg_temp.attendre('Coach : réel de ses magasins seulement', (SELECT count(*) FROM pilotage.reel_mensuel WHERE store_name <> 'Lille'), 0);
SELECT pg_temp.attendre('Coach : tableau limité à ses magasins', (SELECT jsonb_array_length(pilotage.magasins_du_compte(2027))), 1);
SELECT pg_temp.attendre('Coach : lit les paramètres', (SELECT count(*) FROM pilotage.parametres_reseau), 1);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{"v":2}' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas un budget', (SELECT count(*) FROM m), 0);
WITH m AS (UPDATE pilotage.parametres_reseau SET valeur = '{}' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les paramètres', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : ne crée pas de budget', pg_temp.refuse('INSERT INTO pilotage.budgets (store_name, annee, proposition, hypotheses) VALUES (''Lille'', 2028, ''{}'', ''{}'')'), 1);
SELECT pg_temp.attendre('Coach : pas de réel hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.reel_mensuel (store_name, mois, univers, famille) VALUES (''Nice'', ''2026-10-01'', ''cave'', ''Vin'')'), 1);
SELECT pg_temp.attendre('Coach : saisit le réel de son magasin', pilotage.remplacer_reel('[{"store_name":"Lille","mois":"2026-07-01","univers":"cave","famille":"Vin","ca_ht":10,"ca_ttc":12,"marge_ht":3}]', '[{"store_name":"Lille","mois":"2026-07-01","univers":"cave","tickets":1}]')::bigint, 1);
SELECT pg_temp.attendre('Coach : un bloc qui touche un autre magasin échoue en entier', pg_temp.refuse('SELECT pilotage.remplacer_reel(''[{"store_name":"Lille","mois":"2026-06-01","univers":"cave","famille":"Vin","ca_ht":1},{"store_name":"Nice","mois":"2026-06-01","univers":"cave","famille":"Vin","ca_ht":1}]'', ''[]'')'), 1);
SELECT pg_temp.attendre('Coach : rien d''écrit à moitié', (SELECT count(*) FROM pilotage.reel_mensuel WHERE mois = '2026-06-01'), 0);
SELECT pg_temp.attendre('Coach : tickets de ses magasins seulement', (SELECT count(*) FROM pilotage.reel_tickets WHERE store_name <> 'Lille'), 0);
SELECT pg_temp.attendre('Coach : équipe de ses magasins seulement', (SELECT count(*) FROM pilotage.equipe WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel, primes, entree) VALUES ('Lille', 'Vendeur 2', 'employe', 35, 2000, '[{"mois":12,"montant":500}]', '2027-02-01');
WITH m AS (UPDATE pilotage.equipe SET brut_mensuel = 2100 WHERE poste = 'Vendeur 2' RETURNING maj_le)
SELECT pg_temp.attendre('Coach : modifie l''équipe de son magasin', (SELECT count(*) FROM m), 1);
SELECT pg_temp.attendre('Coach : pas d''équipe hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES (''Nice'', ''Vendeur 9'', ''employe'', 35, 1)'), 1);
WITH m AS (DELETE FROM pilotage.equipe WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne supprime pas l''équipe d''un autre magasin', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : frais de ses magasins seulement', (SELECT count(*) FROM pilotage.frais WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.frais (store_name, code, libelle, rubrique, taux_ca) VALUES ('Lille', 'energie', 'Électricité, eau, gaz', 'energies', 0.013);
SELECT pg_temp.attendre('Coach : quadrimestres de ses magasins seulement', (SELECT count(*) FROM pilotage.quadrimestres WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre, achats) VALUES ('Lille', 2026, 2, 90000);
SELECT pg_temp.attendre('Coach : parts réalisées de ses magasins seulement', (SELECT count(*) FROM pilotage.parts_realisees WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.parts_realisees (store_name, annee, univers, part) VALUES ('Lille', 2026, 'bar', 0.62);
SELECT pg_temp.attendre('Coach : correspondances du FEC de ses magasins seulement', (SELECT count(*) FROM pilotage.correspondances_fec WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.correspondances_fec (store_name, compte, rubrique) VALUES ('Lille', '658100', 'personnel');
SELECT pg_temp.attendre('Coach : pas de correspondance hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.correspondances_fec (store_name, compte, rubrique) VALUES (''Nice'', ''658200'', ''achats'')'), 1);
SELECT pg_temp.attendre('Coach : pas de part réalisée hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.parts_realisees (store_name, annee, univers, part) VALUES (''Nice'', 2026, ''cave'', 0.5)'), 1);
SELECT pg_temp.attendre('Coach : pas de quadrimestre hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre, achats) VALUES (''Nice'', 2026, 2, 1)'), 1);
SELECT pg_temp.attendre('Coach : pas de frais hors de ses magasins', pg_temp.refuse('INSERT INTO pilotage.frais (store_name, code, libelle, rubrique, annuel) VALUES (''Nice'', ''energie'', ''Énergie'', ''energies'', 1)'), 1);
WITH m AS (UPDATE pilotage.frais SET annuel = 1 WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les frais d''un autre magasin', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : lit les codes caisse', (SELECT count(*) FROM pilotage.codes_caisse), 2);
SELECT pg_temp.attendre('Coach : ne modifie pas les codes caisse', pg_temp.refuse('INSERT INTO pilotage.codes_caisse (code, store_name) VALUES (''0103'', ''Arras'')'), 1);
SELECT pg_temp.attendre('Coach : pas de journal', (SELECT count(*) FROM pilotage.journal_migrations), 0);
SELECT pg_temp.attendre('Coach : lit les groupes', (SELECT count(*) FROM pilotage.groupes), 2);
SELECT pg_temp.attendre('Coach : ne crée pas de groupe', pg_temp.refuse('INSERT INTO pilotage.groupes (nom) VALUES (''Pirate'')'), 1);
WITH m AS (UPDATE pilotage.cibles_reseau SET valeur = '{}' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas les cibles du réseau', (SELECT count(*) FROM m), 0);
WITH m AS (DELETE FROM pilotage.groupe_magasins RETURNING 1)
SELECT pg_temp.attendre('Coach : ne range pas les magasins', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : réel du compte limité à ses magasins', (SELECT (pg_temp.reel_magasins(2026) = 'Lille')::int), 1);
SELECT pg_temp.attendre('Coach : pas la liste des Coachs', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'coachs')), 0);
SELECT pg_temp.attendre('Coach : pas les RR', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'rrs')), 0);
SELECT pg_temp.attendre('Coach : budgets du compte limités à ses magasins', (SELECT jsonb_array_length(pilotage.budgets_du_compte(2027)->'magasins')), 1);
SELECT pg_temp.attendre('Coach : date d''ouverture de ses magasins seulement', (SELECT count(*) FROM pilotage.ouvertures), 1);
SELECT pg_temp.attendre('Coach : ne change pas une date d''ouverture', pg_temp.refuse('INSERT INTO pilotage.ouvertures (store_name, ouverture) VALUES (''Arras'', ''2025-05-01'')'), 1);
WITH m AS (UPDATE pilotage.ouvertures SET ouverture = '2020-01-01' RETURNING 1)
SELECT pg_temp.attendre('Coach : ne modifie pas la date de son magasin', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Coach : versions nommées de ses magasins seulement', (SELECT count(*) FROM pilotage.versions_nommees), 1);
SELECT pg_temp.attendre('Coach : n''enregistre pas de version nommée', pg_temp.refuse('INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base) VALUES (''Lille'', 2027, ''Coach'', ''{}'')'), 1);
WITH m AS (DELETE FROM pilotage.versions_nommees RETURNING 1)
SELECT pg_temp.attendre('Coach : ne retire pas de version nommée', (SELECT count(*) FROM m), 0);

-- ── RR : les magasins qu'il suit
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
SELECT pg_temp.attendre('RR : budgets des magasins suivis', (SELECT count(*) FROM pilotage.budgets), 2);
WITH m AS (UPDATE pilotage.budgets SET hypotheses = '{"v":2}' RETURNING 1)
SELECT pg_temp.attendre('RR : ne modifie pas un budget', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('RR : réel du compte limité aux magasins suivis', (SELECT (pg_temp.reel_magasins(2026) = 'Lille')::int), 1);
SELECT pg_temp.attendre('RR : Coach des magasins suivis', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'coachs')), 2);
SELECT pg_temp.attendre('RR : pas la liste des RR', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'rrs')), 0);

-- ── Franchisé : son magasin ; modifie ses hypothèses, jamais la proposition ni la validation
SET request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
SELECT pg_temp.attendre('Franchisé : son budget seulement', (SELECT count(*) FROM pilotage.budgets), 1);
SELECT pg_temp.attendre('Franchisé : son réel seulement', (SELECT count(*) FROM pilotage.reel_mensuel WHERE store_name <> 'Lille'), 0);
SELECT pg_temp.attendre('Franchisé : réel du compte limité à son magasin', (SELECT (pg_temp.reel_magasins(2026) = 'Lille')::int), 1);
SELECT pg_temp.attendre('Franchisé : pas la liste des Coachs', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'coachs')), 0);
SELECT pg_temp.attendre('Franchisé : pas les RR', (SELECT count(*) FROM jsonb_object_keys(pilotage.reel_du_compte(2026)->'rrs')), 0);
SELECT pg_temp.attendre('Franchisé : saisit le réel de son magasin', pilotage.remplacer_reel('[{"store_name":"Lille","mois":"2026-05-01","univers":"bar","famille":"Fût","ca_ht":10,"ca_ttc":12,"marge_ht":7}]', '[]')::bigint, 1);
SELECT pg_temp.attendre('Franchisé : pas le réel d''un autre magasin', pg_temp.refuse('SELECT pilotage.remplacer_reel(''[{"store_name":"Nice","mois":"2026-05-01","univers":"bar","famille":"Fût","ca_ht":1}]'', ''[]'')'), 1);
SELECT pg_temp.attendre('Franchisé : son équipe seulement', (SELECT count(*) FROM pilotage.equipe WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES ('Lille', 'Gérant', 'gerant_tns', 45, 2500);
WITH m AS (DELETE FROM pilotage.equipe WHERE poste = 'Gérant' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : gère l''équipe de son magasin', (SELECT count(*) FROM m), 1);
SELECT pg_temp.attendre('Franchisé : pas l''équipe d''un autre magasin', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES (''Nice'', ''Vendeur 9'', ''employe'', 35, 1)'), 1);
SELECT pg_temp.attendre('Franchisé : ses frais seulement', (SELECT count(*) FROM pilotage.frais WHERE store_name <> 'Lille'), 0);
WITH m AS (UPDATE pilotage.frais SET annuel = 62000 WHERE store_name = 'Lille' AND code = 'loyer' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : modifie les frais de son magasin', (SELECT count(*) FROM m), 1);
WITH m AS (UPDATE pilotage.quadrimestres SET personnel = 52000 WHERE store_name = 'Lille' AND quadrimestre = 1 RETURNING 1)
SELECT pg_temp.attendre('Franchisé : modifie les quadrimestres de son magasin', (SELECT count(*) FROM m), 1);
WITH m AS (UPDATE pilotage.parts_realisees SET part = 0.63 WHERE store_name = 'Lille' AND univers = 'cave' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : modifie les parts réalisées de son magasin', (SELECT count(*) FROM m), 1);
WITH m AS (UPDATE pilotage.correspondances_fec SET rubrique = 'achats' WHERE store_name = 'Lille' AND compte = '658000' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : modifie les correspondances du FEC de son magasin', (SELECT count(*) FROM m), 1);
WITH m AS (UPDATE pilotage.correspondances_fec SET rubrique = 'achats' WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne touche pas aux correspondances d''un autre magasin', (SELECT count(*) FROM m), 0);
WITH m AS (UPDATE pilotage.parts_realisees SET part = 0.5 WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne touche pas aux parts réalisées d''un autre magasin', (SELECT count(*) FROM m), 0);
WITH m AS (UPDATE pilotage.quadrimestres SET personnel = 1 WHERE store_name = 'Nice' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne touche pas aux quadrimestres d''un autre magasin', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Franchisé : pas les frais d''un autre magasin', pg_temp.refuse('INSERT INTO pilotage.frais (store_name, code, libelle, rubrique, annuel) VALUES (''Nice'', ''cfe'', ''CFE'', ''impots_taxes'', 1)'), 1);
SELECT pg_temp.attendre('Franchisé : ne lit pas les codes caisse', (SELECT count(*) FROM pilotage.codes_caisse), 0);
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
SELECT pg_temp.attendre('Franchisé : ne lit pas les tables de groupes', (SELECT count(*) FROM pilotage.groupes), 0);
SELECT pg_temp.attendre('Franchisé : ne lit pas les cibles directement', (SELECT count(*) FROM pilotage.cibles_reseau), 0);
SELECT pg_temp.attendre('Franchisé : reçoit les cibles du réseau avec son budget', (SELECT count(*) FROM (SELECT pilotage.budgets_du_compte(2027)->'reseau' AS r) x WHERE r IS NOT NULL AND r <> 'null'::jsonb), 1);
SELECT pg_temp.attendre('Franchisé : seulement le groupe de son magasin', (SELECT jsonb_array_length(pilotage.budgets_du_compte(2027)->'groupes')), 1);
SELECT pg_temp.attendre('Franchisé : ne change pas la base', pg_temp.refuse('UPDATE pilotage.budgets SET base = ''{"b":9}'' WHERE store_name = ''Lille'''), 1);
WITH m AS (UPDATE pilotage.budgets SET ajustements = '{"hausseSalaires":0.01}' WHERE store_name = 'Lille' RETURNING statut)
SELECT pg_temp.attendre('Franchisé : ses ajustements mettent le budget en discussion', (SELECT count(*) FROM m WHERE statut = 'en_discussion'), 1);
SELECT pg_temp.attendre('Franchisé : sa version tracée à son nom', (SELECT count(*) FROM pilotage.versions_budget WHERE auteur_role = 'franchise' AND auteur_nom = 'Franchisé Test' AND statut = 'en_discussion'), 2);
SELECT pg_temp.attendre('Franchisé : versions de son magasin seulement', (SELECT count(*) FROM pilotage.versions_budget WHERE store_name <> 'Lille'), 0);
SELECT pg_temp.attendre('Franchisé : échanges de son magasin seulement', (SELECT count(*) FROM pilotage.echanges_budget WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.echanges_budget (store_name, annee, sujet, texte) VALUES ('Lille', 2027, 'ca', 'D''accord pour +3 %.');
WITH m AS (DELETE FROM pilotage.echanges_budget WHERE auteur_role = 'franchise' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : retire son propre message', (SELECT count(*) FROM m), 1);
SELECT pg_temp.attendre('Franchisé : pas de message sur un autre magasin', pg_temp.refuse('INSERT INTO pilotage.echanges_budget (store_name, annee, texte) VALUES (''Nice'', 2027, ''x'')'), 1);
SELECT pg_temp.attendre('Franchisé : actions de son magasin seulement', (SELECT count(*) FROM pilotage.actions WHERE store_name <> 'Lille'), 0);
WITH m AS (UPDATE pilotage.actions SET statut = 'faite' WHERE store_name = 'Lille' AND type_alerte = 'reel' RETURNING faite_le)
SELECT pg_temp.attendre('Franchisé : marque son action faite, datée par la base', (SELECT count(*) FROM m WHERE faite_le IS NOT NULL), 1);
SELECT pg_temp.attendre('Franchisé : ne change pas l''intitulé d''une action', pg_temp.refuse('UPDATE pilotage.actions SET intitule = ''Rien'' WHERE store_name = ''Lille'''), 1);
SELECT pg_temp.attendre('Franchisé : ne crée pas d''action', pg_temp.refuse('INSERT INTO pilotage.actions (store_name, type_alerte, intitule, responsable, annee) VALUES (''Lille'', ''ca'', ''x'', ''franchise'', 2026)'), 1);
WITH m AS (DELETE FROM pilotage.actions RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne retire pas d''action', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Franchisé : ne crée pas de groupe', pg_temp.refuse('INSERT INTO pilotage.groupes (nom) VALUES (''Pirate'')'), 1);
SELECT pg_temp.attendre('Franchisé : date d''ouverture de son magasin', (SELECT count(*) FROM pilotage.ouvertures WHERE store_name = 'Lille'), 1);
SELECT pg_temp.attendre('Franchisé : pas d''autre date d''ouverture', (SELECT count(*) FROM pilotage.ouvertures WHERE store_name <> 'Lille'), 0);
WITH m AS (DELETE FROM pilotage.ouvertures RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne retire pas sa date d''ouverture', (SELECT count(*) FROM m), 0);
SELECT pg_temp.attendre('Franchisé : versions nommées de son magasin seulement', (SELECT count(*) FROM pilotage.versions_nommees WHERE store_name <> 'Lille'), 0);
INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base) VALUES ('Lille', 2027, 'Avec un vendeur de plus', '{"v":1}');
SELECT pg_temp.attendre('Franchisé : sa version nommée à son nom', (SELECT count(*) FROM pilotage.versions_nommees WHERE auteur_role = 'franchise' AND auteur_nom = 'Franchisé Test'), 1);
SELECT pg_temp.attendre('Franchisé : pas de version nommée sur un autre magasin', pg_temp.refuse('INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base) VALUES (''Nice'', 2027, ''x'', ''{}'')'), 1);
WITH m AS (DELETE FROM pilotage.versions_nommees WHERE auteur_role = 'directeur' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : ne retire pas la version du Directeur', (SELECT count(*) FROM m), 0);
WITH m AS (DELETE FROM pilotage.versions_nommees WHERE auteur_role = 'franchise' RETURNING 1)
SELECT pg_temp.attendre('Franchisé : retire sa propre version', (SELECT count(*) FROM m), 1);

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
SELECT pg_temp.attendre('Sans rôle : aucun groupe', (SELECT count(*) FROM pilotage.groupes), 0);
SELECT pg_temp.attendre('Sans rôle : aucun réel', (SELECT count(*) FROM pilotage.reel_mensuel) + (SELECT count(*) FROM pilotage.reel_tickets), 0);
SELECT pg_temp.attendre('Sans rôle : aucun frais', (SELECT count(*) FROM pilotage.frais), 0);
SELECT pg_temp.attendre('Sans rôle : aucune part réalisée', (SELECT count(*) FROM pilotage.parts_realisees), 0);
SELECT pg_temp.attendre('Sans rôle : aucune correspondance du FEC', (SELECT count(*) FROM pilotage.correspondances_fec), 0);
SELECT pg_temp.attendre('Sans rôle : aucun quadrimestre', (SELECT count(*) FROM pilotage.quadrimestres), 0);
SELECT pg_temp.attendre('Sans rôle : aucun échange ni version', (SELECT count(*) FROM pilotage.echanges_budget) + (SELECT count(*) FROM pilotage.versions_budget), 0);
SELECT pg_temp.attendre('Sans rôle : aucune action', (SELECT count(*) FROM pilotage.actions), 0);
SELECT pg_temp.attendre('Sans rôle : aucune date d''ouverture', (SELECT count(*) FROM pilotage.ouvertures), 0);
SELECT pg_temp.attendre('Sans rôle : aucune version nommée', (SELECT count(*) FROM pilotage.versions_nommees), 0);
SELECT pg_temp.attendre('Sans rôle : n''enregistre pas de version nommée', pg_temp.refuse('INSERT INTO pilotage.versions_nommees (store_name, annee, nom, base) VALUES (''Lille'', 2027, ''x'', ''{}'')'), 1);
SELECT pg_temp.attendre('Sans rôle : n''écrit pas de message', pg_temp.refuse('INSERT INTO pilotage.echanges_budget (store_name, annee, texte) VALUES (''Lille'', 2027, ''x'')'), 1);
SELECT pg_temp.attendre('Sans rôle : ne saisit pas de quadrimestre', pg_temp.refuse('INSERT INTO pilotage.quadrimestres (store_name, annee, quadrimestre) VALUES (''Lille'', 2026, 3)'), 1);
SELECT pg_temp.attendre('Sans rôle : aucune équipe', (SELECT count(*) FROM pilotage.equipe), 0);
SELECT pg_temp.attendre('Sans rôle : n''écrit pas d''équipe', pg_temp.refuse('INSERT INTO pilotage.equipe (store_name, poste, categorie, heures_hebdo, brut_mensuel) VALUES (''Lille'', ''X'', ''employe'', 35, 1)'), 1);
SELECT pg_temp.attendre('Sans rôle : n''écrit pas de réel', pg_temp.refuse('SELECT pilotage.remplacer_reel(''[{"store_name":"Lille","mois":"2026-04-01","univers":"bar","famille":"Fût","ca_ht":1}]'', ''[]'')'), 1);
SELECT pg_temp.attendre('Sans rôle : rien dans le réel du compte', jsonb_array_length(pilotage.reel_du_compte(2026)->'mois'), 0);
SELECT pg_temp.attendre('Sans rôle : rien dans les budgets du compte', (SELECT jsonb_array_length(pilotage.budgets_du_compte(2027)->'magasins') + jsonb_array_length(pilotage.budgets_du_compte(2027)->'groupes')), 0);
SELECT pg_temp.attendre('Sans rôle : pas de cibles du réseau', (SELECT count(*) FROM (SELECT pilotage.budgets_du_compte(2027)->'reseau' AS r) x WHERE r IS NOT NULL AND r <> 'null'::jsonb), 0);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.attendre('Visiteur : aucun accès aux budgets', pg_temp.refuse('SELECT count(*) FROM pilotage.budgets'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux fonctions', pg_temp.refuse('SELECT pilotage.mes_magasins()'), 1);
SELECT pg_temp.attendre('Visiteur : pas de budgets du compte', pg_temp.refuse('SELECT pilotage.budgets_du_compte(2027)'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux groupes', pg_temp.refuse('SELECT count(*) FROM pilotage.groupes'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux frais', pg_temp.refuse('SELECT count(*) FROM pilotage.frais'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux parts réalisées', pg_temp.refuse('SELECT count(*) FROM pilotage.parts_realisees'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux correspondances du FEC', pg_temp.refuse('SELECT count(*) FROM pilotage.correspondances_fec'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux quadrimestres', pg_temp.refuse('SELECT count(*) FROM pilotage.quadrimestres'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux échanges', pg_temp.refuse('SELECT count(*) FROM pilotage.echanges_budget'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux versions', pg_temp.refuse('SELECT count(*) FROM pilotage.versions_budget'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux actions', pg_temp.refuse('SELECT count(*) FROM pilotage.actions'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux dates d''ouverture', pg_temp.refuse('SELECT count(*) FROM pilotage.ouvertures'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès aux versions nommées', pg_temp.refuse('SELECT count(*) FROM pilotage.versions_nommees'), 1);
SELECT pg_temp.attendre('Visiteur : aucun accès à l''équipe', pg_temp.refuse('SELECT count(*) FROM pilotage.equipe'), 1);
SELECT pg_temp.attendre('Visiteur : pas de réel du compte', pg_temp.refuse('SELECT pilotage.reel_du_compte(2026)'), 1);
SELECT pg_temp.attendre('Visiteur : pas d''import de réel', pg_temp.refuse('SELECT pilotage.remplacer_reel(''[]'', ''[]'')'), 1);
RESET ROLE;

-- ── Aucune règle ouverte à tout compte connecté
DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v FROM pg_policies
  WHERE schemaname = 'pilotage' AND (coalesce(qual, '') IN ('true', '') AND cmd <> 'INSERT' OR coalesce(with_check, '') = 'true');
  IF v IS NOT NULL THEN RAISE EXCEPTION 'Règles ouvertes à tout compte connecté : %', v; END IF;
END $$;

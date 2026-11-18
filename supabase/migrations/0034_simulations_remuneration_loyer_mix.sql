-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulateurs « Me rémunérer », « Mon loyer », « Mix Cave et Bar » (choix 287, 291, 292, Joseph
-- 18/11/2026). Réexécutable.
-- Les trois simulateurs de l'app réseau se gardent comme les autres : types `remuneration`, `loyer`, `mix`.
-- Seule la liste des types permis change ; aucun accès ne change (règles de 0031 inchangées). Les règles sociales et
-- fiscales et le repère du loyer vont dans le JSON des paramètres (clé `simulateurs`) : pas de colonne.
-- Suppose 0031_simulations.sql à 0033_simulations_remises_b2b.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.simulations DROP CONSTRAINT IF EXISTS simulations_type_check;
ALTER TABLE pilotage.simulations ADD CONSTRAINT simulations_type_check CHECK (type IN (
  'embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement',
  'exterieur', 'tireuses', 'pression', 'calculette', 'ouverture', 'remises_b2b', 'remuneration', 'loyer', 'mix'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0034', 'simulations_remuneration_loyer_mix')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

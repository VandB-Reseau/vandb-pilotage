-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulateur « Former un collaborateur » (Joseph, 18/11/2026). Réexécutable.
-- Le simulateur de l'app réseau se garde comme les autres : type `formation`.
-- Seule la liste des types permis change ; aucun accès ne change (règles de 0031 inchangées). Les repères (barème
-- kilométrique, OPCO, CPF, aides à l'apprentissage) vont dans le JSON des paramètres (clé `simulateurs`) : pas de colonne.
-- Suppose 0031_simulations.sql à 0034_simulations_remuneration_loyer_mix.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.simulations DROP CONSTRAINT IF EXISTS simulations_type_check;
ALTER TABLE pilotage.simulations ADD CONSTRAINT simulations_type_check CHECK (type IN (
  'embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement',
  'exterieur', 'tireuses', 'pression', 'calculette', 'ouverture', 'remises_b2b', 'remuneration', 'loyer', 'mix', 'formation'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0035', 'simulations_formation')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

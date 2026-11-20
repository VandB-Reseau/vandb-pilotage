-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulateur « Prix du fût d'un gros marché » (Joseph, 20/11/2026). Réexécutable.
-- Le simulateur de l'app réseau se garde comme les autres : type `prix_fut`.
-- Seule la liste des types permis change ; aucun accès ne change (règles de 0031 inchangées).
-- Suppose 0031_simulations.sql à 0035_simulations_formation.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.simulations DROP CONSTRAINT IF EXISTS simulations_type_check;
ALTER TABLE pilotage.simulations ADD CONSTRAINT simulations_type_check CHECK (type IN (
  'embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement',
  'exterieur', 'tireuses', 'pression', 'calculette', 'ouverture', 'remises_b2b', 'remuneration', 'loyer', 'mix', 'formation',
  'prix_fut'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0036', 'simulations_prix_fut')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

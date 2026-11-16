-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulateur « Remises entreprise par paliers » (choix 228, Joseph 16/11/2026). Réexécutable.
-- Le simulateur reprend le fichier « Simulateur remises B2B » de Joseph (paliers de quantité, plancher de marge, par
-- famille ou produit par produit) et se garde comme les autres : type `remises_b2b`.
-- Seule la liste des types permis change ; aucun accès ne change (règles de 0031 inchangées). Paliers, remises et
-- plancher sont saisis dans chaque simulation (JSON `donnees`) : pas de colonne ni de réglage du siège.
-- Suppose 0031_simulations.sql et 0032_simulations_boite_a_outils.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.simulations DROP CONSTRAINT IF EXISTS simulations_type_check;
ALTER TABLE pilotage.simulations ADD CONSTRAINT simulations_type_check CHECK (type IN (
  'embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement',
  'exterieur', 'tireuses', 'pression', 'calculette', 'ouverture', 'remises_b2b'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0033', 'simulations_remises_b2b')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

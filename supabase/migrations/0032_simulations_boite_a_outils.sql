-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — simulateurs de la boîte à outils du coach (vague 9, choix 138 à 146, Joseph 14/11/2026). Réexécutable.
-- Cinq nouveaux simulateurs se gardent comme les autres : contrat extérieur (`exterieur`), parc de tireuses (`tireuses`),
-- carte pression (`pression`), prix et marge (`calculette`), ouverture un dimanche ou un jour férié (`ouverture`).
-- Seule la liste des types permis change ; aucun accès ne change (règles de 0031 inchangées).
-- Les repères réglés par le Directeur (prix du kilomètre, coût horaire, don traité comme un don, TVA, grille de
-- productivité, majorations…) vont dans le JSON des paramètres de l'année (`simulateurs`) : pas de colonne nouvelle.
-- Suppose 0031_simulations.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.simulations DROP CONSTRAINT IF EXISTS simulations_type_check;
ALTER TABLE pilotage.simulations ADD CONSTRAINT simulations_type_check CHECK (type IN (
  'embauche', 'prix', 'tresorerie', 'vente_additionnelle', 'reste_a_faire', 'soiree', 'achat', 'investissement',
  'exterieur', 'tireuses', 'pression', 'calculette', 'ouverture'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0032', 'simulations_boite_a_outils')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

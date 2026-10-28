-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — alertes sur les tickets et le panier (lot 28, 28/10/2026). Réexécutable.
-- Une action du plan peut se rattacher à une alerte « tickets » (fréquentation) ou « panier » (vente additionnelle),
-- Cave et Bar séparés dans l'intitulé. Seuls les types acceptés changent ; les règles d'accès (0012) sont inchangées.
-- Suppose 0012.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.actions DROP CONSTRAINT IF EXISTS actions_type_alerte_check;
ALTER TABLE pilotage.actions ADD CONSTRAINT actions_type_alerte_check
  CHECK (type_alerte IN ('ca', 'marge', 'reel', 'tresorerie', 'tickets', 'panier', 'autre'));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0016', 'alertes_commerciales')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — stock de l'Extérieur en fin de mois (09/11/2026). Réexécutable.
-- Joseph (04/11/2026) : le stock cible de l'Extérieur, en mois d'achats des ventes à venir au prix d'achat, compte dans
-- le graphique du stock et le fonds de roulement comme celui de la Cave et du Bar. Le franchisé saisit donc aussi la
-- valeur du stock de l'Extérieur au dernier jour du mois. Une colonne de plus dans pilotage.stocks, vide pour les mois
-- déjà saisis ; les règles d'accès de la table (0023) ne changent pas : rien n'est ouvert.
-- La cible (mois de stock de l'Extérieur) est un paramètre réseau (parametres_reseau.valeur.tresorerie.stock.mois) :
-- rien à créer pour elle. Suppose 0023_stock_fin_de_mois.sql.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.stocks ADD COLUMN IF NOT EXISTS exterieur numeric;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stocks_exterieur_positif' AND conrelid = 'pilotage.stocks'::regclass) THEN
    ALTER TABLE pilotage.stocks ADD CONSTRAINT stocks_exterieur_positif CHECK (exterieur >= 0);
  END IF;
END $$;
COMMENT ON COLUMN pilotage.stocks.exterieur IS 'Stock de l''Extérieur au prix d''achat HT au dernier jour du mois (vide : non saisi)';

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0030', 'stock_exterieur')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

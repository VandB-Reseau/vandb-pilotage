-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — hausses de salaire datées dans l'équipe (lot 35, 02/11/2026). Réexécutable.
-- Joseph : l'équipe redevient une étape du budget, avec des hausses de salaire à des mois donnés. hausses : liste
-- [{ "mois": "AAAA-MM", "taux": 0.03 }], appliquées à partir de leur mois et cumulées. Les règles d'accès de equipe
-- (0004) sont inchangées. Suppose 0017.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.equipe ADD COLUMN IF NOT EXISTS hausses jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pilotage.equipe DROP CONSTRAINT IF EXISTS equipe_hausses;
ALTER TABLE pilotage.equipe ADD CONSTRAINT equipe_hausses CHECK (jsonb_typeof(hausses) = 'array');

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0019', 'hausses_equipe')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

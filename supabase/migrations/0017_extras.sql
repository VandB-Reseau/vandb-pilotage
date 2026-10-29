-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — extras dans l'équipe (29/10/2026). Réexécutable.
-- Joseph : les extras ne se saisissent plus sur les temps forts mais dans l'équipe, comme un poste, avec une quantité
-- moyenne d'heures par semaine ou par mois et un taux horaire brut. taux_horaire renseigné : la ligne est un poste
-- d'extras, brut_mensuel = taux × heures du mois. Les règles d'accès de equipe (0004) sont inchangées.
-- Suppose 0015.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.equipe ADD COLUMN IF NOT EXISTS taux_horaire numeric;
ALTER TABLE pilotage.equipe DROP CONSTRAINT IF EXISTS equipe_taux_horaire;
ALTER TABLE pilotage.equipe ADD CONSTRAINT equipe_taux_horaire CHECK (taux_horaire IS NULL OR (taux_horaire > 0 AND taux_horaire < 1000));

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0017', 'extras')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — date d'ouverture des magasins (lot 24, 28/10/2026). Réexécutable.
-- Sert à l'ancienneté du magasin (année 1, 2, 3, 4 et plus), qui donne les valeurs par défaut des tickets et du panier
-- de son budget, et à écarter le rythme de sortie des mois qui suivent l'ouverture. Une ligne par magasin, le 1er du
-- mois d'ouverture. Tenue par le Directeur ; lue par chacun sur ses magasins. Suppose 0001_socle_pilotage.sql.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pilotage.ouvertures (
  store_name  text PRIMARY KEY CHECK (store_name <> ''),
  ouverture   date NOT NULL CHECK (extract(day FROM ouverture) = 1 AND ouverture BETWEEN '1950-01-01' AND '2100-12-01'),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid DEFAULT auth.uid()
);

-- ── Règles d'accès : on repart de zéro à chaque passage
DO $$
DECLARE p record;
BEGIN
  ALTER TABLE pilotage.ouvertures ENABLE ROW LEVEL SECURITY;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'pilotage' AND tablename = 'ouvertures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pilotage.ouvertures', p.policyname);
  END LOOP;
  REVOKE ALL ON pilotage.ouvertures FROM PUBLIC, anon, authenticated;
END $$;

-- Lues sur les magasins du compte ; écrites par le Directeur seulement
CREATE POLICY "perimetre_lecture" ON pilotage.ouvertures FOR SELECT TO authenticated
  USING ((SELECT public.est_directeur()) OR (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);
CREATE POLICY "directeur_ecriture" ON pilotage.ouvertures FOR ALL TO authenticated
  USING ((SELECT public.est_directeur()))
  WITH CHECK ((SELECT public.est_directeur()));
GRANT SELECT, INSERT, UPDATE, DELETE ON pilotage.ouvertures TO authenticated;

-- Date de mise à jour
CREATE OR REPLACE FUNCTION pilotage.ouvertures_maj() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ouvertures_maj ON pilotage.ouvertures;
CREATE TRIGGER ouvertures_maj BEFORE UPDATE ON pilotage.ouvertures FOR EACH ROW EXECUTE FUNCTION pilotage.ouvertures_maj();

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0014', 'ouvertures')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

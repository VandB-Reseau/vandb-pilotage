-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — paramètres réseau figés à la validation du budget (lot 38, 02/11/2026). Réexécutable.
-- Joseph : un budget validé ne doit pas bouger quand le Directeur change un paramètre (redevance, charges, trésorerie…).
-- À la validation, la base copie dans le budget les paramètres réseau de son année ; le budget validé se calcule ensuite
-- avec cette copie. Rouvrir le budget efface la copie : il suit de nouveau les paramètres du moment. Personne ne peut
-- écrire la copie lui-même (le déclencheur la recalcule toujours). Les règles d'accès des budgets sont inchangées.
-- Suppose 0001, 0002 et 0018.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.budgets ADD COLUMN IF NOT EXISTS parametres jsonb;
ALTER TABLE pilotage.budgets DROP CONSTRAINT IF EXISTS budgets_parametres;
ALTER TABLE pilotage.budgets ADD CONSTRAINT budgets_parametres CHECK (parametres IS NULL OR jsonb_typeof(parametres) = 'object');

-- Déclencheur nommé pour passer après garde_budget (ordre alphabétique) : il voit le statut final de la ligne
CREATE OR REPLACE FUNCTION pilotage.figer_parametres() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.statut <> 'valide' THEN
    NEW.parametres := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.statut <> 'valide' THEN
    NEW.parametres := coalesce((SELECT p.valeur FROM pilotage.parametres_reseau p WHERE p.annee = NEW.annee), '{}'::jsonb);
  ELSE
    NEW.parametres := OLD.parametres;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS parametres_figes ON pilotage.budgets;
CREATE TRIGGER parametres_figes BEFORE INSERT OR UPDATE ON pilotage.budgets FOR EACH ROW EXECUTE FUNCTION pilotage.figer_parametres();

-- Budgets déjà validés : ils prennent les paramètres actuels de leur année (garde_budget écarté le temps de la reprise,
-- pour ne toucher ni au statut ni à la date de mise à jour)
ALTER TABLE pilotage.budgets DISABLE TRIGGER garde_budget;
ALTER TABLE pilotage.budgets DISABLE TRIGGER parametres_figes;
UPDATE pilotage.budgets b
   SET parametres = coalesce((SELECT p.valeur FROM pilotage.parametres_reseau p WHERE p.annee = b.annee), '{}'::jsonb)
 WHERE b.statut = 'valide' AND b.parametres IS NULL;
ALTER TABLE pilotage.budgets ENABLE TRIGGER parametres_figes;
ALTER TABLE pilotage.budgets ENABLE TRIGGER garde_budget;

-- Budgets du compte : la copie des paramètres est rendue avec chaque budget
CREATE OR REPLACE FUNCTION pilotage.budgets_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mes AS (SELECT unnest(pilotage.mes_magasins()) AS m)
  SELECT jsonb_build_object(
    'magasins', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'magasin', mes.m, 'statut', b.statut, 'base', b.base, 'ajustements', b.ajustements, 'hypotheses', b.hypotheses,
        'maj_le', b.maj_le, 'valide_le', b.valide_le, 'groupe_id', g.groupe_id, 'parametres', b.parametres) ORDER BY mes.m)
      FROM mes
      LEFT JOIN pilotage.budgets b ON b.store_name = mes.m AND b.annee = p_annee
      LEFT JOIN pilotage.groupe_magasins g ON g.store_name = mes.m), '[]'::jsonb),
    'reseau', (SELECT c.valeur FROM pilotage.cibles_reseau c WHERE c.annee = p_annee AND public.mon_role() IN ('directeur', 'rr', 'coach', 'franchise')),
    'groupes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', gr.id, 'nom', gr.nom, 'cibles', cg.valeur) ORDER BY gr.nom)
      FROM pilotage.groupes gr
      LEFT JOIN pilotage.cibles_groupe cg ON cg.groupe_id = gr.id AND cg.annee = p_annee
      WHERE public.est_directeur()
         OR EXISTS (SELECT 1 FROM pilotage.groupe_magasins gm JOIN mes ON mes.m = gm.store_name WHERE gm.groupe_id = gr.id)), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION pilotage.budgets_du_compte(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pilotage.budgets_du_compte(integer) TO authenticated;

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0020', 'parametres_figes')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

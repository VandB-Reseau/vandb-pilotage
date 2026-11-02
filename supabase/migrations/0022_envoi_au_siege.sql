-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — envoi au siège et position du siège (lot 41, 02/11/2026). Réexécutable.
-- Joseph : « Fait tout » sur les propositions du sprint « budget plus fluide » (proposition 3).
-- 1) Le franchisé enregistre ses ajustements sans changer le statut du budget ; c'est l'envoi au siège (statut « en
--    discussion » avec une date d'envoi) qui met le budget en discussion. La base date l'envoi elle-même.
-- 2) La base garde la position du siège : la photo des ajustements du magasin prise chaque fois que le Directeur les
--    écrit (et à la création du budget). L'app en tire ce que le franchisé a changé. Personne d'autre ne l'écrit.
-- RR : inchangé (valide ou rouvre, rien d'autre). Coach : n'écrit toujours pas les budgets. Règles d'accès inchangées.
-- Suppose 0001, 0002, 0011, 0018 et 0020.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE pilotage.budgets ADD COLUMN IF NOT EXISTS ajustements_siege jsonb;
ALTER TABLE pilotage.budgets ADD COLUMN IF NOT EXISTS envoye_le timestamptz;
ALTER TABLE pilotage.budgets DROP CONSTRAINT IF EXISTS budgets_ajustements_siege;
ALTER TABLE pilotage.budgets ADD CONSTRAINT budgets_ajustements_siege CHECK (ajustements_siege IS NULL OR jsonb_typeof(ajustements_siege) = 'object');

CREATE OR REPLACE FUNCTION pilotage.garde_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  IF public.est_directeur() THEN
    IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut <> 'valide') THEN NEW.valide_le := now(); END IF;
    IF NEW.statut <> 'valide' THEN NEW.valide_le := NULL; END IF;
    -- Position du siège : les ajustements tels que le Directeur les écrit ; la date d'envoi reste celle du franchisé
    IF TG_OP = 'INSERT' THEN
      NEW.ajustements_siege := coalesce(NEW.ajustements, '{}'::jsonb);
      NEW.envoye_le := NULL;
    ELSE
      NEW.ajustements_siege := CASE WHEN NEW.ajustements IS DISTINCT FROM OLD.ajustements THEN NEW.ajustements ELSE OLD.ajustements_siege END;
      NEW.envoye_le := OLD.envoye_le;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NEW.store_name <> OLD.store_name OR NEW.annee <> OLD.annee OR NEW.proposition IS DISTINCT FROM OLD.proposition THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  NEW.ajustements_siege := OLD.ajustements_siege;
  -- RR : valider un budget proposé ou en discussion, ou rouvrir un budget validé, rien d'autre
  IF public.mon_role() = 'rr' THEN
    NEW.envoye_le := OLD.envoye_le;
    IF NEW.base IS DISTINCT FROM OLD.base OR NEW.ajustements IS DISTINCT FROM OLD.ajustements THEN RAISE EXCEPTION 'acces_refuse'; END IF;
    IF NEW.statut = 'valide' AND OLD.statut <> 'valide' THEN NEW.valide_le := now(); RETURN NEW; END IF;
    IF NEW.statut = 'en_discussion' AND OLD.statut = 'valide' THEN NEW.valide_le := NULL; NEW.hypotheses := OLD.hypotheses; RETURN NEW; END IF;
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  IF OLD.statut = 'valide' THEN RAISE EXCEPTION 'budget_valide'; END IF;
  -- Franchisé : il enregistre sans changer le statut ; l'envoi (en discussion, date d'envoi changée) est daté par la base
  IF NEW.statut = 'en_discussion' AND NEW.envoye_le IS DISTINCT FROM OLD.envoye_le THEN
    NEW.envoye_le := now();
  ELSE
    NEW.statut := OLD.statut;
    NEW.envoye_le := OLD.envoye_le;
  END IF;
  NEW.valide_le := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS garde_budget ON pilotage.budgets;
CREATE TRIGGER garde_budget BEFORE INSERT OR UPDATE ON pilotage.budgets FOR EACH ROW EXECUTE FUNCTION pilotage.garde_budget();

-- Budgets existants : la position du siège est la dernière version écrite par le Directeur, sinon les ajustements du
-- moment. Déclencheurs écartés le temps de la reprise (ni statut, ni date de mise à jour, ni version touchés).
ALTER TABLE pilotage.budgets DISABLE TRIGGER garde_budget;
ALTER TABLE pilotage.budgets DISABLE TRIGGER parametres_figes;
ALTER TABLE pilotage.budgets DISABLE TRIGGER versions_budget_trace;
UPDATE pilotage.budgets b
   SET ajustements_siege = coalesce((SELECT v.ajustements FROM pilotage.versions_budget v
                                      WHERE v.store_name = b.store_name AND v.annee = b.annee AND v.auteur_role = 'directeur' AND v.ajustements IS NOT NULL
                                      ORDER BY v.cree_le DESC, v.id DESC LIMIT 1), b.ajustements)
 WHERE b.ajustements_siege IS NULL;
ALTER TABLE pilotage.budgets ENABLE TRIGGER versions_budget_trace;
ALTER TABLE pilotage.budgets ENABLE TRIGGER parametres_figes;
ALTER TABLE pilotage.budgets ENABLE TRIGGER garde_budget;

-- Budgets du compte : position du siège et date d'envoi rendues avec chaque budget
CREATE OR REPLACE FUNCTION pilotage.budgets_du_compte(p_annee integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH mes AS (SELECT unnest(pilotage.mes_magasins()) AS m)
  SELECT jsonb_build_object(
    'magasins', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'magasin', mes.m, 'statut', b.statut, 'base', b.base, 'ajustements', b.ajustements, 'hypotheses', b.hypotheses,
        'maj_le', b.maj_le, 'valide_le', b.valide_le, 'groupe_id', g.groupe_id, 'parametres', b.parametres,
        'ajustements_siege', b.ajustements_siege, 'envoye_le', b.envoye_le) ORDER BY mes.m)
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

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0022', 'envoi_au_siege')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

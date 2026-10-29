-- ════════════════════════════════════════════════════════════════
-- V and B Pilotage — le RR valide les budgets de ses magasins (29/10/2026). Réexécutable.
-- Joseph : « c'est le RR qui valide ou le directeur ». Le RR valide ou rouvre un budget de son périmètre ; il ne touche
-- ni à la proposition, ni à la base, ni aux ajustements (seuls le statut et la photo des hypothèses validées changent).
-- Coach et franchisé : inchangés. Suppose 0001 et 0011.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pilotage.garde_budget() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.maj_le := now();
  NEW.maj_par := auth.uid();
  IF public.est_directeur() THEN
    IF NEW.statut = 'valide' AND (TG_OP = 'INSERT' OR OLD.statut <> 'valide') THEN NEW.valide_le := now(); END IF;
    IF NEW.statut <> 'valide' THEN NEW.valide_le := NULL; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'acces_refuse'; END IF;
  IF NEW.store_name <> OLD.store_name OR NEW.annee <> OLD.annee OR NEW.proposition IS DISTINCT FROM OLD.proposition THEN
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  -- RR : valider un budget proposé ou en discussion, ou rouvrir un budget validé, rien d'autre
  IF public.mon_role() = 'rr' THEN
    IF NEW.base IS DISTINCT FROM OLD.base OR NEW.ajustements IS DISTINCT FROM OLD.ajustements THEN RAISE EXCEPTION 'acces_refuse'; END IF;
    IF NEW.statut = 'valide' AND OLD.statut <> 'valide' THEN NEW.valide_le := now(); RETURN NEW; END IF;
    IF NEW.statut = 'en_discussion' AND OLD.statut = 'valide' THEN NEW.valide_le := NULL; NEW.hypotheses := OLD.hypotheses; RETURN NEW; END IF;
    RAISE EXCEPTION 'acces_refuse';
  END IF;
  IF OLD.statut = 'valide' THEN RAISE EXCEPTION 'budget_valide'; END IF;
  NEW.statut := 'en_discussion';
  NEW.valide_le := NULL;
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS "directeur_ou_franchise_modification" ON pilotage.budgets;
DROP POLICY IF EXISTS "modification_selon_role" ON pilotage.budgets;
CREATE POLICY "modification_selon_role" ON pilotage.budgets FOR UPDATE TO authenticated
  USING ((SELECT public.mon_role()) IN ('directeur', 'rr', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name])
  WITH CHECK ((SELECT public.mon_role()) IN ('directeur', 'rr', 'franchise') AND (SELECT pilotage.mes_magasins()) @> ARRAY[store_name]);

INSERT INTO pilotage.journal_migrations (numero, nom) VALUES ('0018', 'validation_rr')
ON CONFLICT (numero) DO UPDATE SET passee_le = now();

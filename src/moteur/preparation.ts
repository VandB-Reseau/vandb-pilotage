// Lot 41 « budget plus fluide » (Joseph, 02/11/2026), propositions 1 et 2 : une fiche « prête à proposer » et la
// proposition des budgets en série. Fonctions pures, testées dans tests/moteur/budget-fluide.spec.ts.

// Ce qu'il faut pour proposer un budget juste : le réel à jour (l'atterrissage en part), la date d'ouverture (ancienneté,
// rythme de sortie), l'équipe et les frais (sans eux, l'EBE n'a pas de sens). Rien n'est bloquant : proposer reste possible.
export type CleControle = 'reel' | 'ouverture' | 'equipe' | 'frais'
export interface EtatFiche { reel: boolean; ouverture: boolean; equipe: boolean; frais: boolean }
export interface Controle { cle: CleControle; libelle: string; fait: boolean; aFaire: string; partie: string }

const CONTROLES: { cle: CleControle; libelle: string; aFaire: string; partie: string }[] = [
  { cle: 'reel', libelle: 'Réel à jour', aFaire: 'Le dernier mois terminé manque', partie: 'reel' },
  { cle: 'ouverture', libelle: 'Date d’ouverture', aFaire: 'Date d’ouverture à renseigner', partie: 'depart' },
  { cle: 'equipe', libelle: 'Équipe', aFaire: 'Aucun poste renseigné', partie: 'equipe' },
  { cle: 'frais', libelle: 'Frais de l’année', aFaire: 'Aucune ligne de frais', partie: 'frais' },
]

export function controlesFiche(e: EtatFiche): Controle[] {
  return CONTROLES.map((c) => ({ ...c, fait: e[c.cle] }))
}
// L'EBE ne se lit qu'avec l'équipe et les frais ; sans eux, il est « incomplet »
export const ebeComplet = (e: Pick<EtatFiche, 'equipe' | 'frais'>) => e.equipe && e.frais
export const ficheComplete = (e: EtatFiche) => CONTROLES.every((c) => e[c.cle])

// Proposition à mettre à jour : l'atterrissage de l'année en cours a bougé de plus de 2 % depuis la proposition
export const SEUIL_MISE_A_JOUR = 0.02
export function ecartAtterrissage(caProposition: number | null, caAtterri: number): number | null {
  return caProposition && caProposition > 0 ? caAtterri / caProposition - 1 : null
}

export type Action = 'proposer' | 'mettre_a_jour' | 'aucune'
export type StatutBudget = 'propose' | 'en_discussion' | 'valide' | null
// Ce que la proposition en série ferait pour un magasin, et s'il est coché d'office :
// - sans budget : proposer, coché si l'équipe et les frais sont là ;
// - proposé : mettre à jour, coché si l'atterrissage a bougé de plus de 2 % et que l'équipe et les frais sont là ;
// - en discussion : mettre à jour possible (les ajustements du magasin restent), jamais coché d'office ;
// - validé : rien.
export function actionSerie(statut: StatutBudget, ecart: number | null, e: Pick<EtatFiche, 'equipe' | 'frais'>): { action: Action; coche: boolean } {
  if (statut === 'valide') return { action: 'aucune', coche: false }
  if (!statut) return { action: 'proposer', coche: ebeComplet(e) }
  const bouge = ecart !== null && Math.abs(ecart) > SEUIL_MISE_A_JOUR
  return { action: 'mettre_a_jour', coche: statut === 'propose' && bouge && ebeComplet(e) }
}

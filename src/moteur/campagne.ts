// Campagne des budgets (lot 28, 28/10/2026) : trois dates fixées par le Directeur dans Paramètres réseau, l'avancement
// par Responsable Régional et par Coach. Un budget est en retard s'il n'est pas proposé après la date de proposition,
// ou pas validé après la date de validation. Dates au format AAAA-MM-JJ, comparées comme du texte.

export interface Campagne { proposition: string; retour: string; validation: string }
type StatutBudget = 'propose' | 'en_discussion' | 'valide' | null

// Dates d'exemple, à corriger dans Paramètres réseau : mi-novembre, début et fin décembre de l'année d'avant
export const campagneParDefaut = (annee: number): Campagne => ({
  proposition: `${annee - 1}-11-15`, retour: `${annee - 1}-12-05`, validation: `${annee - 1}-12-19`,
})

export const campagneDe = (p: { campagne?: Campagne }, annee: number): Campagne => p.campagne ?? campagneParDefaut(annee)

export function enRetard(statut: StatutBudget, c: Campagne, aujourdhui: string): boolean {
  return (!statut && aujourdhui > c.proposition) || (statut !== 'valide' && aujourdhui > c.validation)
}

// commentaires : commentaires encore ouverts sur les budgets (Joseph, 03/11/2026)
export interface Avancement { nom: string; magasins: number; aProposer: number; proposes: number; enDiscussion: number; valides: number; enRetard: number; commentaires: number }

// Une ligne par responsable (un magasin peut avoir plusieurs RR), la plus en retard d'abord ; « Sans nom » si aucun
export function avancementCampagne(
  magasins: { statut: StatutBudget; responsables: string[]; commentaires?: number }[], c: Campagne, aujourdhui: string,
): Avancement[] {
  const lignes = new Map<string, Avancement>()
  for (const m of magasins) {
    for (const nom of m.responsables.length ? m.responsables : ['']) {
      const a = lignes.get(nom) ?? { nom, magasins: 0, aProposer: 0, proposes: 0, enDiscussion: 0, valides: 0, enRetard: 0, commentaires: 0 }
      a.magasins++
      if (!m.statut) a.aProposer++
      else if (m.statut === 'propose') a.proposes++
      else if (m.statut === 'en_discussion') a.enDiscussion++
      else a.valides++
      if (enRetard(m.statut, c, aujourdhui)) a.enRetard++
      a.commentaires += m.commentaires ?? 0
      lignes.set(nom, a)
    }
  }
  return [...lignes.values()].sort((a, b) => b.enRetard - a.enRetard || (a.nom === '' ? 1 : b.nom === '' ? -1 : a.nom.localeCompare(b.nom, 'fr')))
}

// Lot 43 (Joseph, 03/11/2026) : la campagne se lit en quatre étapes, les mêmes pour tous les rôles
export type EtapeCampagne = 'a_proposer' | 'chez_franchise' | 'retour' | 'valide'
export const ETAPES_CAMPAGNE: { cle: EtapeCampagne; libelle: string }[] = [
  { cle: 'a_proposer', libelle: 'À proposer' },
  { cle: 'chez_franchise', libelle: 'Chez le franchisé' },
  { cle: 'retour', libelle: 'Retour du franchisé' },
  { cle: 'valide', libelle: 'Validés' },
]
export const etapeCampagne = (statut: StatutBudget): EtapeCampagne =>
  !statut ? 'a_proposer' : statut === 'propose' ? 'chez_franchise' : statut === 'en_discussion' ? 'retour' : 'valide'

// Jours entiers écoulés entre une date ISO et aujourd'hui (AAAA-MM-JJ) ; null sans date
export function joursDepuis(iso: string | null | undefined, aujourdhui: string): number | null {
  if (!iso) return null
  const j = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
  return Math.max(0, Math.round((j(aujourdhui) - j(iso.slice(0, 10))) / 86_400_000))
}

// Depuis quand le budget attend à son étape : chez le franchisé depuis la dernière modification (la proposition ou la
// dernière mise à jour), en retour depuis l'envoi au siège (à défaut la dernière modification). Rien à proposer ni validé.
export function attente(m: { statut: StatutBudget; majLe: string | null; envoyeLe?: string | null }, aujourdhui: string): number | null {
  if (m.statut === 'propose') return joursDepuis(m.majLe, aujourdhui)
  if (m.statut === 'en_discussion') return joursDepuis(m.envoyeLe ?? m.majLe, aujourdhui)
  return null
}

// Vue du Directeur : une ligne par Responsable Régional, dépliée sur les Coachs de ses magasins
export interface AvancementRR extends Avancement { coachs: Avancement[] }
export function avancementParRR(
  magasins: { statut: StatutBudget; rrs: string[]; coach: string | null; commentaires?: number }[], c: Campagne, aujourdhui: string,
): AvancementRR[] {
  return avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: m.rrs, commentaires: m.commentaires })), c, aujourdhui).map((l) => ({
    ...l,
    coachs: avancementCampagne(
      magasins.filter((m) => (l.nom === '' ? !m.rrs.length : m.rrs.includes(l.nom))).map((m) => ({ statut: m.statut, responsables: m.coach ? [m.coach] : [], commentaires: m.commentaires })),
      c, aujourdhui),
  }))
}

// Vue du Coach : ses magasins un par un, en retard d'abord, puis l'attente la plus longue
export interface MagasinCampagne { magasin: string; etape: EtapeCampagne; attente: number | null; enRetard: boolean }
export function magasinsCampagne(
  magasins: { magasin: string; statut: StatutBudget; majLe: string | null; envoyeLe?: string | null }[], c: Campagne, aujourdhui: string,
): MagasinCampagne[] {
  const rang: Record<EtapeCampagne, number> = { a_proposer: 0, chez_franchise: 1, retour: 2, valide: 3 }
  return magasins.map((m) => ({ magasin: m.magasin, etape: etapeCampagne(m.statut), attente: attente(m, aujourdhui), enRetard: enRetard(m.statut, c, aujourdhui) }))
    .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || (b.attente ?? -1) - (a.attente ?? -1) || rang[a.etape] - rang[b.etape] || a.magasin.localeCompare(b.magasin, 'fr'))
}

// Lot 43 : marque courte de l'état de chaque étape du budget dans le menu, selon qui regarde.
// « changements » : ajustements du magasin enregistrés mais pas encore envoyés au siège ; « ici » : l'étape affichée,
// qui porte « Non enregistré » quand une saisie y attend (le point de départ pour la trésorerie, sinon « Construire »).
export function marquesEtapes(e: {
  statut: StatutBudget; propose: boolean; modifie: boolean; changements: number
  role: 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'
}): Record<'budget' | 'visualiser' | 'echanges', string> {
  const franchise = e.role === 'franchise', valideur = e.role === 'directeur' || e.role === 'rr'
  // Joseph (03/11/2026) : trois étapes ; « Construire » dit aussi si le budget attend la proposition du siège
  const budget = !e.propose ? (e.role === 'directeur' ? 'À proposer' : 'En attente du siège') : e.statut === 'valide' ? 'Validé' : e.modifie ? 'Non enregistré'
    : franchise && e.statut === 'propose' ? (e.changements ? `${e.changements} changement${e.changements > 1 ? 's' : ''} à envoyer` : 'À relire') : ''
  const echanges = !e.propose ? '' : e.statut === 'valide' ? 'Validé'
    : e.statut === 'en_discussion' ? (valideur ? 'À valider' : franchise ? 'Envoyé au siège' : 'Retour du franchisé')
      : franchise ? 'À envoyer' : 'Chez le franchisé'
  return { budget, visualiser: '', echanges }
}

import { syntheseReel, type LigneReel, type TicketsReel } from './reel'
import { UNIVERS, type Hypotheses, type LigneFrais, type Univers } from './types'

// Atterrissage de l'année en cours à partir du réel, et base du budget de l'an prochain (lot 4, 27/10/2026).
// - Mois réalisés : le réel tel quel (CA et marge par famille, tickets).
// - Mois restants : moyenne mensuelle réalisée de la famille × saisonnalité de son univers l'année précédente
//   (mois k de N-1 rapporté à la moyenne des mêmes mois réalisés en N-1). Sans réel N-1 : la moyenne réalisée.
//   Le CA atterri d'une famille vaut donc son réalisé / part de l'année réalisée de son univers en N-1.
// - Marge : taux réalisé de la famille, appliqué aux mois projetés.
// La base renvoyée passe ensuite par calculerBudget : évolution nulle pour l'atterrissage, cibles pour le budget.

export interface Finances { amortissements: number; interets: number; remboursementCapital: number }
export interface ReelAnnees { n: { lignes: LigneReel[]; tickets: TicketsReel[] }; n1: { lignes: LigneReel[]; tickets: TicketsReel[] } }
export interface BaseDepuisReel {
  base: Hypotheses
  moisRealises: number
  methode: 'saisonnalite' | 'moyenne'
  realise: number                                     // CA HT de janvier à la fin du dernier mois réalisé
  parMois: { ca: number; projete: boolean }[]
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

export function baseDepuisReel(reel: ReelAnnees, annee: number, frais: LigneFrais[] = [], finances?: Finances): BaseDepuisReel | null {
  const s = syntheseReel(reel.n.lignes, reel.n.tickets)
  const m = s.moisRenseignes
  if (m === 0) return null
  const n1 = syntheseReel(reel.n1.lignes, reel.n1.tickets)
  // CA N-1 par univers et par mois, pour la saisonnalité
  const n1Univers = Object.fromEntries(UNIVERS.map((u) => [u, Array(12).fill(0)])) as Record<Univers, number[]>
  for (const f of n1.familles) f.parMois.forEach((v, i) => { n1Univers[f.univers][i] += v })
  const avecSaisonnalite = (u: Univers) => somme(n1Univers[u].slice(0, m)) > 0 && somme(n1Univers[u].slice(m)) > 0

  // Part de l'année réalisée à fin m, par univers
  const partRealisee: Partial<Record<Univers, number>> = {}
  for (const u of UNIVERS) partRealisee[u] = avecSaisonnalite(u) ? somme(n1Univers[u].slice(0, m)) / somme(n1Univers[u]) : m / 12

  const caMois = Array(12).fill(0)
  for (const f of s.familles) {
    const ytd = somme(f.parMois.slice(0, m))
    const moyenne = ytd / m
    const ref = n1Univers[f.univers]
    const moyenneRef = somme(ref.slice(0, m)) / m
    f.parMois.forEach((v, i) => {
      caMois[i] += i < m ? v : avecSaisonnalite(f.univers) ? moyenne * ref[i] / moyenneRef : moyenne
    })
  }

  // Tickets réalisés ; panier TTC sur les seuls mois où les tickets sont connus
  const flux: Hypotheses['flux'] = {}
  for (const u of ['cave', 'bar'] as const) {
    const tickets = reel.n.tickets.filter((t) => t.univers === u && t.mois <= m && t.tickets > 0)
    const t = somme(tickets.map((x) => x.tickets))
    const moisTickets = new Set(tickets.map((x) => x.mois))
    const ttc = somme(reel.n.lignes.filter((l) => l.univers === u && moisTickets.has(l.mois)).map((l) => l.caTTC ?? 0))
    if (t > 0) flux[u] = { realise: t, evolution: 0, panierCibleTTC: ttc / t }
  }

  return {
    base: {
      annee, moisRealises: m, caMensuelReference: caMois, partRealisee,
      familles: s.familles.map((f) => {
        const ca = somme(f.parMois.slice(0, m))
        const taux = f.caHT ? f.margeHT / f.caHT : 0
        return { univers: f.univers, famille: f.famille, caRealise: ca, margeRealisee: taux, evolution: 0, margeCible: taux }
      }),
      flux,
      personnel: { salairesMensuels: Array(12).fill(0), remunerationGerance: 0, tauxCotisationsGerance: 0, heuresMensuelles: Array(12).fill(0) },
      frais,
      amortissements: finances?.amortissements ?? 0,
      interets: finances?.interets ?? 0,
      remboursementCapital: finances?.remboursementCapital ?? 0,
      deficitReportable: 0,
    },
    moisRealises: m,
    methode: UNIVERS.some((u) => avecSaisonnalite(u)) ? 'saisonnalite' : 'moyenne',
    realise: somme(s.parMois.slice(0, m).map((x) => x.caHT)),
    parMois: caMois.map((ca, i) => ({ ca, projete: i >= m })),
  }
}

// ── Frais d'un magasin enregistrés ligne par ligne ; emprunts et amortissements à part
export const CODES_FINANCES = { amortissements: 'amortissements', interets: 'interets', remboursementCapital: 'remboursement_capital' } as const
export interface LigneFraisMagasin { code: string; libelle: string; rubrique: string; annuel: number | null; tauxCA: number | null }

export function fraisDepuisLignes(lignes: LigneFraisMagasin[]): { frais: LigneFrais[]; finances: Finances } {
  const valeur = (code: string) => lignes.find((l) => l.code === code)?.annuel ?? 0
  const codesFinances = Object.values(CODES_FINANCES) as string[]
  return {
    frais: lignes.filter((l) => !codesFinances.includes(l.code)).map((l) => ({
      code: l.code, libelle: l.libelle, rubrique: l.rubrique as LigneFrais['rubrique'],
      ...(l.tauxCA !== null ? { tauxCA: l.tauxCA } : { annuel: l.annuel ?? 0 }),
    })),
    finances: { amortissements: valeur(CODES_FINANCES.amortissements), interets: valeur(CODES_FINANCES.interets), remboursementCapital: valeur(CODES_FINANCES.remboursementCapital) },
  }
}

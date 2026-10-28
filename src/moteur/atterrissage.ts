import { syntheseReel, type LigneReel, type TicketsReel } from './reel'
import { UNIVERS, type Hypotheses, type LigneFrais, type Univers } from './types'

// Atterrissage de l'année en cours à partir du réel, et base du budget de l'an prochain (lot 4, 27/10/2026).
// - Mois réalisés : le réel tel quel (CA et marge par famille, tickets).
// - Mois restants : le CA atterri d'une famille vaut son réalisé / part de l'année réalisée de son univers, le reste
//   réparti sur les mois restants selon une saisonnalité. Part et saisonnalité, par ordre de priorité (lot 16, 28/10/2026) :
//   1. part saisie pour l'univers (comme dans le prévisionnel Excel), reste réparti selon la saisonnalité du réseau ;
//   2. saisonnalité de l'univers dans le magasin l'année précédente ;
//   3. saisonnalité médiane du réseau l'année précédente (magasins qui ont leurs 12 mois) ;
//   4. moyenne des mois réalisés.
// - Marge : taux réalisé de la famille, appliqué aux mois projetés.
// La base renvoyée passe ensuite par calculerBudget : évolution nulle pour l'atterrissage, cibles pour le budget.

export interface Finances { amortissements: number; interets: number; remboursementCapital: number }
export interface ReelAnnees { n: { lignes: LigneReel[]; tickets: TicketsReel[] }; n1: { lignes: LigneReel[]; tickets: TicketsReel[] } }
export interface BaseDepuisReel {
  base: Hypotheses
  moisRealises: number
  methode: 'saisonnalite' | 'moyenne'                 // saisonnalité : au moins un univers ne projette pas sur la moyenne
  methodes: Record<Univers, MethodeAtterrissage>
  realise: number                                     // CA HT de janvier à la fin du dernier mois réalisé
  parMois: { ca: number; projete: boolean }[]
}

export type MethodeAtterrissage = 'saisie' | 'magasin' | 'reseau' | 'moyenne'
export interface SecoursAtterrissage {
  parts?: Partial<Record<Univers, number>>   // part de l'année réalisée à fin du dernier mois, saisie par univers
  saisonnaliteReseau?: number[] | null       // 12 poids (total 1), médiane du réseau l'année précédente
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Saisonnalité médiane : poids de chaque mois dans l'année des magasins qui ont leurs 12 mois, médiane mois par mois, total 1
export function saisonnaliteMediane(annees: number[][]): number[] | null {
  const completes = annees.filter((l) => l.length === 12 && l.every((v) => v > 0)).map((l) => l.map((v) => v / somme(l)))
  if (completes.length < 3) return null
  const med = Array.from({ length: 12 }, (_, i) => {
    const t = completes.map((l) => l[i]).sort((a, b) => a - b), k = Math.floor(t.length / 2)
    return t.length % 2 ? t[k] : (t[k - 1] + t[k]) / 2
  })
  return med.map((v) => v / somme(med))
}

export function baseDepuisReel(reel: ReelAnnees, annee: number, frais: LigneFrais[] = [], finances?: Finances, secours: SecoursAtterrissage = {}): BaseDepuisReel | null {
  const s = syntheseReel(reel.n.lignes, reel.n.tickets)
  const m = s.moisRenseignes
  if (m === 0) return null
  const n1 = syntheseReel(reel.n1.lignes, reel.n1.tickets)
  // CA N-1 par univers et par mois, pour la saisonnalité
  const n1Univers = Object.fromEntries(UNIVERS.map((u) => [u, Array(12).fill(0)])) as Record<Univers, number[]>
  for (const f of n1.familles) f.parMois.forEach((v, i) => { n1Univers[f.univers][i] += v })
  const reseau = secours.saisonnaliteReseau ?? null
  const egal = Array(12).fill(1 / 12)

  // Par univers : part de l'année réalisée à fin m et poids des mois (seuls les mois restants comptent pour la projection)
  const methodes = {} as Record<Univers, MethodeAtterrissage>
  const partRealisee: Partial<Record<Univers, number>> = {}
  const poids = {} as Record<Univers, number[]>
  for (const u of UNIVERS) {
    const ref = n1Univers[u]
    const saisie = secours.parts?.[u]
    if (saisie && saisie > 0 && saisie <= 1) {
      methodes[u] = 'saisie'; partRealisee[u] = saisie; poids[u] = reseau ?? egal
    } else if (somme(ref.slice(0, m)) > 0 && somme(ref.slice(m)) > 0) {
      methodes[u] = 'magasin'; partRealisee[u] = somme(ref.slice(0, m)) / somme(ref); poids[u] = ref
    } else if (reseau) {
      methodes[u] = 'reseau'; partRealisee[u] = somme(reseau.slice(0, m)); poids[u] = reseau
    } else {
      methodes[u] = 'moyenne'; partRealisee[u] = m / 12; poids[u] = egal
    }
  }

  // Mois projeté i d'une famille : réalisé × (1 / part − 1), réparti selon les poids des mois restants
  const caMois = Array(12).fill(0)
  for (const f of s.familles) {
    const ytd = somme(f.parMois.slice(0, m))
    const w = poids[f.univers], reste = somme(w.slice(m))
    const aProjeter = ytd * (1 / partRealisee[f.univers]! - 1)
    f.parMois.forEach((v, i) => { caMois[i] += i < m ? v : reste > 0 ? aProjeter * w[i] / reste : 0 })
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
    methode: UNIVERS.some((u) => methodes[u] !== 'moyenne') ? 'saisonnalite' : 'moyenne',
    methodes,
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

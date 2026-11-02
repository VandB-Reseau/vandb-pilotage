import type { LigneReel, TicketsReel } from './reel'
import { effetsSurLaMarge, type Suivi } from './suivi'
import { UNIVERS, universLibelle, type Budget, type Univers } from './types'

// Lot 41, proposition 5 (Joseph, 02/11/2026) : d'où vient l'écart au budget, à fin du dernier mois réalisé.
// CA, univers par univers (mêmes mois) :
// - Cave et Bar construits par les tickets, tickets connus chaque mois : tickets budgétés = tickets de l'année du budget
//   × part du CA de l'univers de ces mois dans son CA de l'année ; effet tickets = CA budgété × (tickets réels ÷ tickets
//   budgétés − 1) ; effet panier = écart de CA de l'univers − effet tickets (le reste : le panier, prix et mix compris).
// - Sinon : l'écart de CA de l'univers, d'un bloc.
// La somme des effets est exactement l'écart de CA. Marge : effet du CA et effet du taux (effetsSurLaMarge, lot 38).
// Sans détail par univers dans le budget (budget enregistré avant le lot 24) : l'écart de CA total seul.
// Fonctions pures, testées dans tests/moteur/budget-fluide.spec.ts.

export interface EffetEcart { cle: string; libelle: string; effet: number }
export interface EcartExplique {
  moisRealises: number
  ecartCA: number
  ca: EffetEcart[]                       // somme = ecartCA
  marge: { effetCA: number; effetTaux: number | null; ecart: number | null }
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

export function ecartExplique(lignes: LigneReel[], tickets: TicketsReel[], budget: Budget, suivi: Suivi): EcartExplique | null {
  const n = suivi.moisRealises
  if (n === 0) return null
  const ecartCA = suivi.cumul.ecartCA
  const effets = effetsSurLaMarge(suivi)
  const marge = { effetCA: effets.effetCA, effetTaux: effets.effetTaux, ecart: suivi.cumul.ecartMarge }
  const detail = budget.mois.slice(0, n).every((m) => !!m.univers)
  if (!detail) return { moisRealises: n, ecartCA, ca: [{ cle: 'ca', libelle: 'Chiffre d’affaires', effet: ecartCA }], marge }

  const ca: EffetEcart[] = []
  for (const u of UNIVERS) {
    const caBudget = somme(budget.mois.slice(0, n).map((m) => m.univers![u].ca))
    const caReel = somme(lignes.filter((l) => l.univers === u && l.mois <= n).map((l) => l.caHT))
    if (caBudget === 0 && caReel === 0) continue
    const ecart = caReel - caBudget
    const f = u === 'cave' || u === 'bar' ? budget.flux[u] : undefined
    const caAnnee = somme(budget.mois.map((m) => m.univers![u].ca))
    const parMois = Array.from({ length: n }, (_, i) => somme(tickets.filter((t) => t.univers === u && t.mois === i + 1).map((t) => t.tickets)))
    const ticketsConnus = parMois.every((t) => t > 0)
    if (f?.parTickets && ticketsConnus && caAnnee > 0 && caBudget > 0 && f.objectif > 0) {
      const ticketsBudget = f.objectif * caBudget / caAnnee
      const effetTickets = caBudget * (somme(parMois) / ticketsBudget - 1)
      ca.push({ cle: `tickets/${u}`, libelle: `Tickets ${universLibelle[u]}`, effet: effetTickets })
      ca.push({ cle: `panier/${u}`, libelle: `Panier moyen ${universLibelle[u]}`, effet: ecart - effetTickets })
    } else {
      ca.push({ cle: `ca/${u}`, libelle: `CA ${universLibelle[u as Univers]}`, effet: ecart })
    }
  }
  // Écart hors univers (arrondis, familles sans univers connu) : rattaché au dernier effet pour que la somme tombe juste
  const reste = ecartCA - somme(ca.map((e) => e.effet))
  if (ca.length && Math.abs(reste) > 0.005) ca[ca.length - 1] = { ...ca[ca.length - 1], effet: ca[ca.length - 1].effet + reste }
  return { moisRealises: n, ecartCA, ca, marge }
}

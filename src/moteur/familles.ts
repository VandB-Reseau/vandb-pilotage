import { mediane } from './comparaison'
import type { Famille, Univers } from './types'

// Familles et corners face au réseau (lot 29, 28/10/2026) : poids de chaque famille dans le CA de son univers et son taux
// de marge, face à la médiane des magasins qui ont cet univers (une famille absente d'un magasin y pèse 0 %).
// Potentiel : si le magasin pèse moins que la médiane sur une famille mieux margée que le reste de l'univers, la marge
// gagnée en déplaçant vers elle l'écart de poids, CA de l'univers inchangé :
//   (poids médian − poids) × CA de l'univers × (taux de la famille − taux du reste de l'univers)
// Sur le CA réalisé de l'année en cours (base des budgets). Médiane seulement à partir de 3 magasins.

export const MIN_MAGASINS_FAMILLE = 3
export interface FamilleReseau {
  univers: Univers; famille: string
  poids: number; tauxMarge: number | null
  medianePoids: number | null; medianeTaux: number | null; magasins: number
  potentiel: number | null
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const cle = (f: { univers: Univers; famille: string }) => `${f.univers}|${f.famille}`

export function famillesFaceAuReseau(moi: Famille[], reseau: Famille[][]): FamilleReseau[] {
  const caUnivers = (l: Famille[], u: Univers) => somme(l.filter((f) => f.univers === u).map((f) => f.caRealise))
  const toutes = new Map<string, { univers: Univers; famille: string }>()
  for (const f of [...moi, ...reseau.flat()]) if (f.caRealise > 0 || moi.includes(f)) toutes.set(cle(f), { univers: f.univers, famille: f.famille })
  const lignes: FamilleReseau[] = []
  for (const { univers: u, famille } of toutes.values()) {
    const caU = caUnivers(moi, u)
    if (caU <= 0) continue
    const f = moi.find((x) => x.univers === u && x.famille === famille)
    const ca = f?.caRealise ?? 0
    // Magasins du réseau qui ont l'univers : poids de la famille (0 si absente), taux là où elle se vend
    const avec = reseau.filter((l) => caUnivers(l, u) > 0)
    const poidsR = avec.map((l) => somme(l.filter((x) => x.univers === u && x.famille === famille).map((x) => x.caRealise)) / caUnivers(l, u))
    const tauxR = avec.flatMap((l) => l.filter((x) => x.univers === u && x.famille === famille && x.caRealise > 0).map((x) => x.margeRealisee / x.caRealise))
    const assez = avec.length >= MIN_MAGASINS_FAMILLE
    const medianePoids = assez ? mediane(poidsR) : null
    const medianeTaux = tauxR.length >= MIN_MAGASINS_FAMILLE ? mediane(tauxR) : null
    const poids = ca / caU
    const tauxMarge = ca > 0 ? f!.margeRealisee / ca : null
    // Taux du reste de l'univers : les autres familles du magasin
    const reste = moi.filter((x) => x.univers === u && x.famille !== famille)
    const caReste = somme(reste.map((x) => x.caRealise))
    const tauxReste = caReste > 0 ? somme(reste.map((x) => x.margeRealisee)) / caReste : null
    const tauxF = tauxMarge ?? medianeTaux
    const potentiel = medianePoids !== null && medianePoids > poids && tauxF !== null && tauxReste !== null && tauxF > tauxReste
      ? (medianePoids - poids) * caU * (tauxF - tauxReste) : null
    lignes.push({ univers: u, famille, poids, tauxMarge, medianePoids, medianeTaux, magasins: avec.length, potentiel })
  }
  return lignes.sort((a, b) => (b.potentiel ?? -1) - (a.potentiel ?? -1) || a.univers.localeCompare(b.univers) || b.poids - a.poids)
}

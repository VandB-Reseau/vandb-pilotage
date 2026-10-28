import type { MoisReel } from './suivi'
import type { UniversTickets } from './types'

// Projection du CA (lot 24, Joseph 28/10/2026). Trois leviers par univers, sans double comptage :
// rythme de sortie de l'année en cours × (1 + tickets) × (1 + panier), puis temps forts et ajustements datés.
// - Rythme de sortie : CA des 4 derniers mois réalisés ÷ leur poids dans la saisonnalité. Retenu d'office si l'écart à
//   l'atterrissage reste sous 15 %, au-delà sur confirmation du Directeur.
// - Ancienneté (millésime) : elle ne s'ajoute pas, elle donne les valeurs par défaut des tickets et du panier.
// - Hausse tarifaire du réseau : valeur par défaut du panier quand rien d'autre n'est fixé.

export const MOIS_SORTIE = 4
export const SEUIL_RYTHME = 0.15
export const MAGASINS_MINI_CALAGE = 8

export type Tranche = '1' | '2' | '3' | '4'
export const TRANCHES: Tranche[] = ['1', '2', '3', '4']
export const trancheLibelle: Record<Tranche, string> = { 1: 'Année 1', 2: 'Année 2', 3: 'Année 3', 4: 'Année 4 et plus' }

export interface Ouverture { annee: number; mois: number } // mois de 1 à 12

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Ancienneté du magasin à mi-année (1er juillet) : un magasin ouvert en février 2025 est surtout dans sa 3e année en 2027,
// un magasin ouvert en novembre 2025 dans sa 2e. Ouverture dans l'année ou plus tard : année 1.
export function trancheMillesime(o: Ouverture | null | undefined, annee: number): Tranche | null {
  if (!o) return null
  const mois = (annee - o.annee) * 12 + (7 - o.mois)
  if (mois < 12) return '1'
  return String(Math.min(4, Math.floor(mois / 12) + 1)) as Tranche
}

// Calage des valeurs par défaut sur le réseau, univers par univers, pour chaque ancienneté de l'année n :
// - tickets : tickets de janvier au dernier mois connu de n, face au rythme de sortie de n − 1 (septembre à décembre
//   annualisés) ramené à la même part de l'année. C'est la croissance au-delà de ce qui était déjà acquis ;
// - panier : panier TTC de n face à celui de n − 1, sur les mêmes mois (le panier a sa propre saisonnalité, Noël surtout).
// Médiane des magasins, publiée à partir de 8 magasins. Ouverts après juin de n − 1 : exclus (lancement dans la fenêtre).
export interface Constat { mediane: number | null; magasins: number }
export type Calage = Record<Tranche, Record<UniversTickets, { tickets: Constat; panier: Constat }>>
export function calageMillesimes(magasins: { ouverture: Ouverture | null | undefined; n: MoisReel[]; n1: MoisReel[] }[], annee: number, saisonnalite: number[] | null, mini = MAGASINS_MINI_CALAGE): Calage {
  const valeurs = Object.fromEntries(TRANCHES.map((t) => [t, { cave: { tickets: [] as number[], panier: [] as number[] }, bar: { tickets: [] as number[], panier: [] as number[] } }]))
  for (const m of magasins) {
    const tranche = trancheMillesime(m.ouverture, annee)
    if (!tranche || !saisonnalite || !m.ouverture || m.ouverture.annee * 12 + m.ouverture.mois > (annee - 1) * 12 + 6) continue
    let k = 0
    while (k < 12 && m.n[k]?.caHT > 0) k++
    if (k === 0 || k === 12) continue
    const fenetre = [8, 9, 10, 11]
    const poidsSortie = somme(fenetre.map((i) => saisonnalite[i])), poidsAnnee = somme(saisonnalite.slice(0, k))
    for (const u of ['cave', 'bar'] as const) {
      const t = (l: MoisReel[], mois: number[]) => somme(mois.map((i) => l[i]?.univers?.[u].tickets ?? 0))
      const ttc = (l: MoisReel[], mois: number[]) => somme(mois.map((i) => l[i]?.univers?.[u].caTTC ?? 0))
      const debut = Array.from({ length: k }, (_, i) => i)
      const sortie = t(m.n1, fenetre)
      if (sortie > 0 && poidsSortie > 0 && poidsAnnee > 0 && t(m.n, debut) > 0) {
        valeurs[tranche][u].tickets.push(t(m.n, debut) / (sortie / poidsSortie * poidsAnnee) - 1)
      }
      if (t(m.n1, debut) > 0 && t(m.n, debut) > 0 && ttc(m.n1, debut) > 0) {
        valeurs[tranche][u].panier.push((ttc(m.n, debut) / t(m.n, debut)) / (ttc(m.n1, debut) / t(m.n1, debut)) - 1)
      }
    }
  }
  const mediane = (l: number[]): Constat => {
    if (l.length < mini) return { mediane: null, magasins: l.length }
    const s = [...l].sort((a, b) => a - b), k = Math.floor(s.length / 2)
    return { mediane: s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2, magasins: l.length }
  }
  return Object.fromEntries(TRANCHES.map((t) => [t, {
    cave: { tickets: mediane(valeurs[t].cave.tickets), panier: mediane(valeurs[t].cave.panier) },
    bar: { tickets: mediane(valeurs[t].bar.tickets), panier: mediane(valeurs[t].bar.panier) },
  }])) as Calage
}

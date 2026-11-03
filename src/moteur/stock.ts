import { UNIVERS, type Budget, type Univers } from './types'

// Valeur du stock en fin de mois (Joseph, 03/11/2026) : un magasin bien achalandé garde en stock, au prix d'achat,
// 2,5 mois d'achats pour la Cave et 1 mois pour le Bar. Les « mois d'achats » sont ceux des ventes à venir, au prix
// d'achat (coût d'achat des marchandises vendues) : fin octobre, le stock de la Cave couvre novembre, décembre et la
// moitié de janvier. La cible suit ainsi la saison toute seule (on remplit avant Noël, on allège en janvier).
// Extérieur : marchandise achetée pour l'événement, pas de stock (0 mois). Tolérance : 10 % de part et d'autre de la
// cible avant d'afficher un écart (hypothèse, modifiable dans les Paramètres réseau).

export interface ParametresStock {
  mois: Record<Univers, number>   // mois d'achats des ventes à venir à garder en stock
  tolerance: number               // écart toléré autour de la cible, en part de la cible
}
export const stockParDefaut: ParametresStock = { mois: { cave: 2.5, bar: 1, exterieur: 0 }, tolerance: 0.1 }

// Coût d'achat des ventes (achats consommés) par univers et par mois, sur au moins 12 mois à partir de janvier de
// l'année suivie ; au-delà de ce qui est fourni, l'année recommence (régime établi).
export type CoutVentes = Record<Univers, number[]>

const valeurMois = (l: number[], i: number) => (l.length ? l[i < l.length ? i : i % 12] ?? 0 : 0)

// Valeur des « mois » d'achats qui suivent la fin du mois fin (0 = janvier) : mois entiers puis fraction du dernier
export function achatsAVenir(l: number[], fin: number, mois: number): number {
  let total = 0, reste = mois, i = fin + 1
  while (reste > 1e-9) {
    const part = Math.min(1, reste)
    total += valeurMois(l, i) * part
    reste -= part
    i++
  }
  return total
}

// Mois d'achats à venir que couvre une valeur de stock (inverse de achatsAVenir), plafonné à 24 mois
export function moisCouverts(l: number[], fin: number, valeur: number): number {
  let reste = valeur, mois = 0
  for (let i = fin + 1; mois < 24; i++) {
    const v = valeurMois(l, i)
    if (v <= 0) { mois++; continue }
    if (reste <= v) return mois + reste / v
    reste -= v
    mois++
  }
  return 24
}

export function cibleStock(cout: CoutVentes, fin: number, p: ParametresStock = stockParDefaut): Record<Univers, number> {
  return Object.fromEntries(UNIVERS.map((u) => [u, achatsAVenir(cout[u] ?? [], fin, p.mois[u] ?? 0)])) as Record<Univers, number>
}

export type EtatStock = 'bas' | 'ok' | 'haut'
export const etatStock = (valeur: number, cible: number, tolerance: number): EtatStock =>
  valeur < cible * (1 - tolerance) - 1e-9 ? 'bas' : valeur > cible * (1 + tolerance) + 1e-9 ? 'haut' : 'ok'

export interface StockSaisi { cave: number | null; bar: number | null }
export interface MoisStock {
  mois: number                        // 1 à 12
  cible: number; mini: number; maxi: number
  cibleUnivers: Record<'cave' | 'bar', number>
  reel: number | null                 // Cave + Bar saisis (null si rien n'est saisi)
  reelUnivers: StockSaisi
  ecart: number | null                // réel − cible
  etat: EtatStock | null
  // Mois d'achats à venir couverts, par univers (null sans saisie ou sans achats à venir)
  couverture: Record<'cave' | 'bar', number | null>
}
export interface SuiviStock {
  mois: MoisStock[]
  dernier: MoisStock | null           // dernier mois saisi
  saisis: number
}

// Stock de fin de mois face à sa cible, mois par mois. Saisies : 12 cases (null = mois non saisi).
export function suiviStock(cout: CoutVentes, saisies: (StockSaisi | null)[], p: ParametresStock = stockParDefaut): SuiviStock {
  const mois = Array.from({ length: 12 }, (_, i): MoisStock => {
    const c = cibleStock(cout, i, p)
    const cible = c.cave + c.bar + c.exterieur
    const s = saisies[i] ?? null
    const vide = !s || (s.cave === null && s.bar === null)
    const reel = vide ? null : (s!.cave ?? 0) + (s!.bar ?? 0)
    const couvre = (u: 'cave' | 'bar') => {
      const v = s?.[u]
      return v === null || v === undefined || !(p.mois[u] > 0) ? null : moisCouverts(cout[u] ?? [], i, v)
    }
    return {
      mois: i + 1, cible, mini: cible * (1 - p.tolerance), maxi: cible * (1 + p.tolerance),
      cibleUnivers: { cave: c.cave, bar: c.bar },
      reel, reelUnivers: { cave: s?.cave ?? null, bar: s?.bar ?? null },
      ecart: reel === null ? null : reel - cible,
      etat: reel === null ? null : etatStock(reel, cible, p.tolerance),
      couverture: { cave: couvre('cave'), bar: couvre('bar') },
    }
  })
  const saisisMois = mois.filter((m) => m.reel !== null)
  return { mois, dernier: saisisMois.at(-1) ?? null, saisis: saisisMois.length }
}

// Coût d'achat des ventes d'un budget (ou d'un atterrissage) par univers et par mois ; budget de l'année suivante en
// prolongement s'il existe, sinon la même année recommence. Sans détail par univers (budget ancien) : tout en Cave.
export function coutVentesDe(annee: Budget, suivante?: Budget | null): CoutVentes {
  const de = (b: Budget, u: Univers) => b.mois.map((m) => (m.univers ? m.univers[u].achats : u === 'cave' ? m.achats : 0))
  return Object.fromEntries(UNIVERS.map((u) => [u, [...de(annee, u), ...(suivante ? de(suivante, u) : [])]])) as CoutVentes
}

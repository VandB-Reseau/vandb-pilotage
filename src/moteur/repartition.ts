import { MOIS_LONGS } from '../lib/format'
import { FAMILLES_PAR_UNIVERS, type LigneReel } from './reel'
import type { Univers } from './types'

// Réel saisi par univers seulement (Joseph, 03/11/2026) : le franchisé peut saisir le CA HT d'un univers sans le détail
// par famille. La base garde une ligne « Non détaillé » par univers ; la répartition sur les familles est recalculée à
// la lecture, comme le réel complété : un détail saisi plus tard ou un import la remplace.
// Référence des parts, la première qui existe :
// 1. le même mois de l'an dernier, détaillé (le rosé l'été, les bulles en décembre) ;
// 2. les 3 mois précédents de l'année, détaillés ;
// 3. tous les mois détaillés de l'année ;
// 4. toute l'année dernière, détaillée.
// CA HT et CA TTC répartis selon la part de CA de chaque famille ; la marge saisie selon sa part de marge, pour garder le
// taux de chaque famille. Marge non saisie : elle reste vide (le reste de l'app sait déjà la traiter comme inconnue,
// sans alerte). Sans aucune référence, la ligne reste « Non détaillé ».

export const NON_DETAILLE = 'Non détaillé'

export interface Reference {
  source: string                                       // « septembre 2025 », « les 3 mois précédents »…
  parts: { famille: string; partCA: number; partMarge: number | null }[]
  ratioTTC: number | null                              // CA TTC ÷ CA HT des lignes de référence qui ont un TTC
}

const detaillees = (l: LigneReel[], u: Univers) => l.filter((x) => x.univers === u && x.famille !== NON_DETAILLE && !x.reparti && x.caHT > 0)

function construire(lignes: LigneReel[], source: string): Reference | null {
  const ca = lignes.reduce((a, l) => a + l.caHT, 0)
  if (ca <= 0) return null
  const avecMarge = lignes.filter((l) => l.margeHT !== null)
  const marge = avecMarge.reduce((a, l) => a + (l.margeHT ?? 0), 0)
  const avecTTC = lignes.filter((l) => l.caTTC !== null && l.caTTC > 0)
  const htAvecTTC = avecTTC.reduce((a, l) => a + l.caHT, 0)
  const parFamille = new Map<string, { ca: number; marge: number }>()
  for (const l of lignes) {
    const f = parFamille.get(l.famille) ?? { ca: 0, marge: 0 }
    f.ca += l.caHT
    f.marge += l.margeHT ?? 0
    parFamille.set(l.famille, f)
  }
  return {
    source,
    parts: [...parFamille].map(([famille, f]) => ({ famille, partCA: f.ca / ca, partMarge: marge > 0 && avecMarge.length === lignes.length ? f.marge / marge : null })),
    ratioTTC: htAvecTTC > 0 ? avecTTC.reduce((a, l) => a + (l.caTTC ?? 0), 0) / htAvecTTC : null,
  }
}

export function referenceRepartition(lignes: LigneReel[], lignesN1: LigneReel[], mois: number, u: Univers, anneeN1?: number): Reference | null {
  const n = detaillees(lignes, u), n1 = detaillees(lignesN1, u)
  return construire(n1.filter((l) => l.mois === mois), `${MOIS_LONGS[mois - 1]}${anneeN1 ? ` ${anneeN1}` : ' de l’an dernier'}`)
    ?? construire(n.filter((l) => l.mois < mois && l.mois >= mois - 3), 'les 3 mois précédents')
    ?? construire(n, 'les autres mois de l’année')
    ?? construire(n1, 'l’an dernier')
}

// Une famille unique (l'Extérieur, « Factures ») n'a rien à répartir : la saisie par univers y va directement
export const familleUnique = (u: Univers): string | null => (FAMILLES_PAR_UNIVERS[u].length === 1 ? FAMILLES_PAR_UNIVERS[u][0] : null)

const arrondi = (v: number) => Math.round(v * 100) / 100

// Répartit une ligne d'univers selon une référence ; la dernière famille prend le reste pour que la somme tombe juste
export function repartirLigne(l: LigneReel, ref: Reference): LigneReel[] {
  let ca = l.caHT, ttc = l.caTTC, marge = l.margeHT
  return ref.parts.map((p, i) => {
    const dernier = i === ref.parts.length - 1
    const caF = dernier ? ca : arrondi(l.caHT * p.partCA)
    const ttcF = l.caTTC === null ? null : dernier ? ttc! : arrondi(l.caTTC * p.partCA)
    const margeF = l.margeHT === null ? null : dernier ? marge! : arrondi(l.margeHT * (p.partMarge ?? p.partCA))
    ca -= caF
    if (ttc !== null && ttcF !== null) ttc -= ttcF
    if (marge !== null && margeF !== null) marge -= margeF
    return { mois: l.mois, univers: l.univers, famille: p.famille, caHT: arrondi(caF), caTTC: ttcF === null ? null : arrondi(ttcF), margeHT: margeF === null ? null : arrondi(margeF), reparti: true as const }
  })
}

// Lignes de l'année avec les lignes « Non détaillé » remplacées par leur répartition
export function repartirNonDetaille(lignes: LigneReel[], lignesN1: LigneReel[], anneeN1?: number): LigneReel[] {
  if (!lignes.some((l) => l.famille === NON_DETAILLE)) return lignes
  return lignes.flatMap((l) => {
    if (l.famille !== NON_DETAILLE) return [l]
    const ref = referenceRepartition(lignes, lignesN1, l.mois, l.univers, anneeN1)
    return ref ? repartirLigne(l, ref) : [l]
  })
}

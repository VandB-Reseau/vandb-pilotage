import { expect, test } from '@playwright/test'
import type { Personne } from '../../src/moteur/equipe'
import { chargesParDefaut } from '../../src/moteur/parametres'
import type { LigneReel, TicketsReel } from '../../src/moteur/reel'
import { ligneReseau, moisDuReel, suiviBudget, totalReseau, type EntreeReseau } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'

// Réel face au budget et indicateurs du réseau, sur des magasins fictifs : chaque résultat se vérifie à la main.
const proche = (v: number | null, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

// Budget : 20 000 € de CA et 8 000 € de marge chaque mois (40 %)
const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 20_000, marge: 8_000 })), tauxMarge: 0.4 } as unknown as Budget
// Janvier : 22 000 € de CA, marge complète de 10 000 € ; février : 18 000 €, marge du Fût inconnue
const lignes: LigneReel[] = [
  { mois: 1, univers: 'cave', famille: 'Bière', caHT: 18_000, caTTC: 21_600, margeHT: 7_000 },
  { mois: 1, univers: 'bar', famille: 'Fût', caHT: 4_000, caTTC: 4_800, margeHT: 3_000 },
  { mois: 2, univers: 'cave', famille: 'Bière', caHT: 15_000, caTTC: 18_000, margeHT: 6_000 },
  { mois: 2, univers: 'bar', famille: 'Fût', caHT: 3_000, caTTC: null, margeHT: null },
]
const tickets: TicketsReel[] = [{ mois: 1, univers: 'cave', tickets: 1_000 }]

test('réel face au budget : écarts du mois, cumul, marge seulement sur les mois complets', () => {
  const s = suiviBudget(moisDuReel(lignes, tickets), budget)
  expect(s.moisRealises).toBe(2)
  expect(s.mois[0]).toEqual({ caReel: 22_000, caBudget: 20_000, ecartCA: 2_000, margeReel: 10_000, margeBudget: 8_000, ecartMarge: 2_000 })
  // Février : marge incomplète, pas d'écart de marge
  expect(s.mois[1]).toEqual({ caReel: 18_000, caBudget: 20_000, ecartCA: -2_000, margeReel: null, margeBudget: 8_000, ecartMarge: null })
  expect(s.mois[2].caReel).toBeNull()
  expect(s.cumul.caReel).toBe(40_000)
  expect(s.cumul.caBudget).toBe(40_000)
  expect(s.cumul.ecartCA).toBe(0)
  expect(s.cumul.ecartCAPart).toBe(0)
  proche(s.cumul.tauxMargeReel, 16_000 / 37_000)   // marges connues sur le CA des familles qui en ont une
  expect(s.cumul.margeReel).toBe(10_000)            // janvier seul
  expect(s.cumul.margeBudget).toBe(8_000)
  expect(s.cumul.ecartMarge).toBe(2_000)
  // Sans réel : rien de réalisé
  expect(suiviBudget(moisDuReel([], []), budget).cumul.ecartCAPart).toBeNull()
})

test('réseau : indicateurs à date de chaque magasin et total pondéré par le CA', () => {
  const p = { tauxRedevance: 0.02, tauxPublicite: 0.01, charges: { ...chargesParDefaut, taux: { ...chargesParDefaut.taux, gerant_tns: 0.5 } }, annee: 2027 }
  // Gérant TNS à 2 000 € brut et 50 % de cotisations : 3 000 € par mois
  const gerant: Personne = { poste: 'Gérant', categorie: 'gerant_tns', heuresHebdo: 35, brutMensuel: 2_000, primes: [], entree: null, sortie: null }
  const vide = moisDuReel([], [])
  const a: EntreeReseau = {
    magasin: 'Brionne-sur-Lac', n: moisDuReel(lignes, tickets),
    n1: moisDuReel([1, 2].map((mois) => ({ mois, univers: 'cave' as const, famille: 'Vin', caHT: 16_000, caTTC: null, margeHT: null })), []),
    budget, equipe: [gerant],
    frais: [{ code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier', annuel: 12_000 }, { code: 'energie', libelle: 'Énergie', rubrique: 'energies', tauxCA: 0.01 }],
  }
  const b: EntreeReseau = {
    magasin: 'Valcourt', n: moisDuReel([1, 2].map((mois) => ({ mois, univers: 'cave' as const, famille: 'Vin', caHT: 10_000, caTTC: null, margeHT: 5_000 })), []),
    n1: vide, budget: null, equipe: undefined, frais: undefined,
  }
  const c: EntreeReseau = { magasin: 'Saint-Aubin-des-Prés', n: vide, n1: vide, budget: null, equipe: undefined, frais: undefined }
  const [la, lb, lc] = [a, b, c].map((e) => ligneReseau(e, p))

  expect(la.moisRealises).toBe(2)
  expect(la.ca).toBe(40_000)
  proche(la.evolution, 0.25)                       // 40 000 / 32 000 − 1
  proche(la.ecartBudget, 0)
  proche(la.tauxMarge, 16_000 / 37_000)
  proche(la.panierTTC, 26.4)                       // janvier : 26 400 € TTC / 1 000 tickets
  // Marge de tout le CA : 40 000 × 16 000 / 37 000 = 640 000 / 37 ; équipe 6 000 €
  proche(la.personnelSurMarge, 6_000 / (640_000 / 37))
  // EBE : 640 000 / 37 − redevance et publicité 1 200 − loyer 2 000 − énergie 400 − équipe 6 000
  proche(la.ebeSurCA, (640_000 / 37 - 9_600) / 40_000)

  // Sans an dernier, budget, équipe ni frais : seuls CA et marge
  expect(lb).toMatchObject({ ca: 20_000, evolution: null, ecartBudget: null, tauxMarge: 0.5, panierTTC: null, personnelSurMarge: null, ebeSurCA: null })
  expect(lc.moisRealises).toBe(0)

  const t = totalReseau([la, lb, lc])
  expect(t.magasins).toBe(2)                       // le magasin sans réel ne compte pas
  expect(t.ca).toBe(60_000)
  proche(t.evolution, 0.25)                        // seulement les magasins qui ont un an dernier
  proche(t.ecartBudget, 0)
  proche(t.tauxMarge, 26_000 / 57_000)
  proche(t.panierTTC, 26.4)
  proche(t.personnelSurMarge, la.personnelSurMarge!)
  proche(t.ebeSurCA, la.ebeSurCA!)
})

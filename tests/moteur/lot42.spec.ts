import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { appliquerCibles, copieParThemes, type Cibles } from '../../src/moteur/cibles'
import { pointsAvantValidation, pretsAValider, themesVus } from '../../src/moteur/changements'
import { controlesQuadrimestre } from '../../src/moteur/controleComptes'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { avecReprise, comptesAnnee, tresorerieDepartEstimee } from '../../src/moteur/reprise'
import type { SaisieQuadrimestre } from '../../src/moteur/quadrimestre'
import type { Hypotheses } from '../../src/moteur/types'
import { MOIS_LONGS } from '../../src/lib/format'

// Lot 42 (Joseph, 02/11/2026). Magasin fictif aux mois identiques : chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 6) => expect(v).toBeCloseTo(attendu, chiffres)
const p = { ...parametresParDefaut, tauxRedevance: 0.02, tauxPublicite: 0.01 }

// 8 mois réalisés à 50 000 € de CA HT, une famille Cave à 50 % de marge ; ni équipe ni frais saisis
const base: Hypotheses = {
  annee: 2027, moisRealises: 8, caMensuelReference: Array(12).fill(50_000),
  familles: [{ univers: 'cave', famille: 'Vins', caRealise: 400_000, margeRealisee: 0.5, evolution: 0, margeCible: 0.5 }],
  personnel: { salairesMensuels: Array(12).fill(0), remunerationGerance: 0, tauxCotisationsGerance: 0, heuresMensuelles: Array(12).fill(0) },
  frais: [], amortissements: 0, interets: 1_200, remboursementCapital: 12_000, deficitReportable: 0,
}
const q = (s: Partial<SaisieQuadrimestre>): SaisieQuadrimestre => ({ achats: null, variationStock: null, chargesExternes: null, impotsTaxes: null, personnel: null, tresorerie: null, ...s })
// Janvier à août 2026 saisis : personnel 50 000 € et charges externes 30 000 € (redevance et publicité comprises), impôts
// et taxes 4 000 € par quadrimestre ; 30 000 € de trésorerie fin août
const saisies = { 1: q({ personnel: 50_000, chargesExternes: 30_000, impotsTaxes: 4_000, tresorerie: 22_000 }), 2: q({ personnel: 50_000, chargesExternes: 30_000, impotsTaxes: 4_000, tresorerie: 30_000 }) }

test('équipe et frais repris des comptes, faute de saisie', () => {
  const c = comptesAnnee(2026, saisies, 0.03)!
  expect(c.quadrimestres).toEqual([1, 2])
  expect(c.tresorerie).toEqual({ montant: 30_000, quadrimestre: 2 })
  const h = avecReprise(base, c, { equipe: false, frais: false })
  expect(h.reprise).toEqual({ annee: 2026, mois: 8, personnel: true, frais: true })
  proche(h.personnel.salairesMensuels[0], 12_500)           // 100 000 € sur 8 mois
  // Charges externes : 60 000 − 3 % de 400 000 € de CA (redevance et publicité, recalculées par le budget) = 48 000 € sur 8 mois
  proche(h.frais[0].annuel, 72_000)
  proche(h.frais[1].annuel, 12_000)                         // 8 000 € sur 8 mois
  expect(h.frais[1].rubrique).toBe('impots_taxes')
  // Budget sans évolution : marge 25 000 € par mois − redevance et publicité 1 500 − frais 6 000 − impôts 1 000 − personnel 12 500
  const b = calculerBudget(h, p)
  proche(b.ca, 600_000)
  proche(b.personnel, 150_000)
  proche(b.ebe, 12 * 4_000)
  // La hausse des salaires et l'inflation des frais s'appliquent aux montants repris
  const r = appliquerCibles(h, [{ niveau: 'magasin', cibles: { hausseSalaires: 0.02, inflationFrais: 0.1 } }]).hypotheses
  proche(calculerBudget(r, p).personnel, 153_000)
  proche(r.frais.find((f) => f.rubrique === 'autres')!.annuel, 79_200)
  // Ce qui est saisi n'est jamais remplacé
  expect(avecReprise(base, c, { equipe: true, frais: false }).reprise).toEqual({ annee: 2026, mois: 8, personnel: false, frais: true })
  expect(avecReprise(base, c, { equipe: true, frais: true })).toBe(base)
  // Un quadrimestre sans frais de personnel ne compte pas
  expect(comptesAnnee(2026, { 1: q({ chargesExternes: 1, impotsTaxes: 1 }) }, 0.03)).toBeNull()
})

test('trésorerie au 1er janvier estimée depuis la fin du dernier quadrimestre', () => {
  const c = comptesAnnee(2026, saisies, 0.03)!
  const h = avecReprise(base, c, { equipe: false, frais: false })
  // 30 000 € fin août + 4 mois × (EBE 4 000 − intérêts et capital 1 100) = 41 600 €
  const d = tresorerieDepartEstimee(h, c, p)!
  expect(d).toEqual({ montant: 41_600, depuis: 30_000, quadrimestre: 2, annee: 2026 })
  expect(tresorerieDepartEstimee(h, { ...c, tresorerie: null }, p)).toBeNull()
  // Validation : la trésorerie estimée est signalée et sera figée
  expect(pointsAvantValidation({ tresorerieDepart: undefined, pointBas: null, changementsNonEnvoyes: false, estimee: '41,6 k€' }, MOIS_LONGS)[0].texte)
    .toBe('La trésorerie au 1er janvier n’est pas saisie : elle est estimée à 41,6 k€ depuis les comptes, et sera figée à ce montant.')
})

test('copie des hypothèses thème par thème', () => {
  const modele: Cibles = { evolutionFlux: { cave: 0.04 }, margeFamille: { 'cave/Vins': 0.45 }, hausseSalaires: 0.03, travaux: { activite: Array(12).fill(1), gain: 0, investissement: 0, dureeAmortissement: 5 }, tresorerieDepart: 9 }
  const vise: Cibles = { evolutionPanier: { cave: 0.01 }, margeFamille: { 'cave/Bière': 0.3 }, tresorerieDepart: 50_000 }
  // Ventes seulement : tickets du modèle, le panier du magasin visé est repris par le siège (le modèle n'en a pas)
  expect(copieParThemes(modele, vise, ['ventes'])).toEqual({ evolutionFlux: { cave: 0.04 }, margeFamille: { 'cave/Bière': 0.3 }, tresorerieDepart: 50_000 })
  // Ventes et marge ; jamais les travaux ni la trésorerie
  expect(copieParThemes(modele, vise, ['ventes', 'marge', 'equipe'])).toEqual({ evolutionFlux: { cave: 0.04 }, margeFamille: { 'cave/Vins': 0.45 }, hausseSalaires: 0.03, tresorerieDepart: 50_000 })
  // Le modèle n'est pas touché
  expect(modele.evolutionFlux).toEqual({ cave: 0.04 })
})

test('budgets prêts à valider et thèmes vus par le franchisé', () => {
  const siege: Cibles = { evolutionFlux: { cave: 0.02 } }
  const l = [
    { magasin: 'A', statut: 'en_discussion', envoyeLe: '2026-12-01', siege, ajustements: { evolutionFlux: { cave: 0.02 }, tresorerieDepart: 20_000, accords: ['ventes'] } },
    { magasin: 'B', statut: 'en_discussion', envoyeLe: '2026-12-01', siege, ajustements: { evolutionFlux: { cave: 0.03 } } },
    { magasin: 'C', statut: 'en_discussion', envoyeLe: null, siege, ajustements: siege },
    { magasin: 'D', statut: 'propose', envoyeLe: null, siege, ajustements: siege },
  ]
  expect(pretsAValider(l).map((x) => x.magasin)).toEqual(['A'])
  expect(themesVus(siege, { evolutionFlux: { cave: 0.02 }, accords: ['equipe'] })).toEqual(['equipe'])
  expect(themesVus(siege, { evolutionFlux: { cave: 0.03 }, poidsMois: Array(12).fill(1 / 12), accords: ['equipe'] })).toEqual(['tresoBudget', 'ventes', 'equipe']) // la répartition par mois se règle au point de départ
})

test('comptes du quadrimestre contrôlés à la saisie', () => {
  // CA 200 000 €, marge de caisse 45 %
  const juste = q({ achats: 112_000, variationStock: 2_000, chargesExternes: 30_000, impotsTaxes: 2_000, personnel: 50_000 })
  expect(controlesQuadrimestre(juste, 200_000, 0.45, 0.03)).toEqual([])
  // Achats TTC (112 000 × 1,2) : marge 33,8 % pour 45 % en caisse
  const ttc = controlesQuadrimestre({ ...juste, achats: 134_400 }, 200_000, 0.45, 0.03)
  expect(ttc.map((c) => [c.champ, c.texte])).toEqual([['variationStock', 'Marge réelle à 33,8 % pour 45 % en caisse : achats bien HT ? Variation de stock dans le bon sens (une hausse du stock se saisit en positif) ?']])
  // Un mois de personnel au lieu de quatre, charges externes sans la redevance, variation de stock oubliée
  const l = controlesQuadrimestre({ ...juste, personnel: 12_500, chargesExternes: 4_000, variationStock: null }, 200_000, 0.45, 0.03)
  expect(l.map((c) => [c.champ, c.gravite])).toEqual([['variationStock', 'info'], ['personnel', 'question'], ['chargesExternes', 'question']])
  // Écart de plus de 25 % au budget de la période
  const b = controlesQuadrimestre(juste, 200_000, 0.45, 0.03, { achats: 110_000, chargesExternes: 22_000, impotsTaxes: 2_000, personnel: 52_000 })
  expect(b.map((c) => c.texte)).toEqual(['Charges externes au-dessus du budget de la période de 36,4 % : chiffre à confirmer.'])
  expect(controlesQuadrimestre(juste, 0, 0.45, 0.03)).toEqual([])
})

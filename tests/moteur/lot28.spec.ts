import { expect, test } from '@playwright/test'
import { alertesMagasin, alertesParDefaut, type EntreeAlertes } from '../../src/moteur/alertes'
import { avancementCampagne, campagneParDefaut, enRetard } from '../../src/moteur/campagne'
import { AUCUN_LEVIER, baseLeviers, effetLeviers } from '../../src/moteur/leviers'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'
import { ficheVisite } from '../../src/moteur/visite'

// Lot 28 : alertes tickets et panier, fiche de visite, leviers commerciaux, campagne des budgets. Magasin fictif,
// chaque résultat se vérifie à la main.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const mois = (cave: [number, number], bar: [number, number], marge = 4_000): MoisReel => ({
  caHT: 10_000, margeHT: marge, caAvecMarge: 10_000, caTTC: 12_000, tickets: cave[0] + bar[0],
  univers: { cave: { tickets: cave[0], caTTC: cave[1] }, bar: { tickets: bar[0], caTTC: bar[1] } },
})
const vide: MoisReel = { caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }
// Cette année, janvier à juin : la Cave perd 10 % de tickets d'avril à juin (900 contre 1 000), panier stable à 40 € ;
// le Bar garde ses 500 tickets mais son panier passe de 16 € à 15 €
const n = [
  ...Array.from({ length: 3 }, () => mois([1_000, 40_000], [500, 7_500])),
  ...Array.from({ length: 3 }, () => mois([900, 36_000], [500, 7_500])),
  ...Array.from({ length: 6 }, () => vide),
]
const n1 = Array.from({ length: 12 }, () => mois([1_000, 40_000], [500, 8_000]))
const entree: EntreeAlertes = { magasin: 'Brionne-sur-Lac', n, n1, budget: null, moisTermines: 6, tresorerieReelle: null, tresorerieBudget: null }

test('alertes tickets et panier : 3 derniers mois face à l’an dernier, Cave et Bar séparés', () => {
  // Cave : 2 700 tickets d'avril à juin contre 3 000, −10 % ; panier 108 000 / 2 700 = 40 €, stable
  // Bar : tickets stables ; panier 22 500 / 1 500 = 15 € contre 24 000 / 1 500 = 16 €, −6,25 %
  expect(alertesMagasin(entree, alertesParDefaut)).toEqual([
    { magasin: 'Brionne-sur-Lac', type: 'tickets', univers: 'cave', ecart: expect.closeTo(-0.1, 9), de: 4, mois: 6 },
    { magasin: 'Brionne-sur-Lac', type: 'panier', univers: 'bar', panier: expect.closeTo(15, 9), ecart: expect.closeTo(-0.0625, 9), de: 4, mois: 6 },
  ])
  // Seuils relevés à 10 % et 7 % : un écart de 10 % tout juste n'alerte pas
  expect(alertesMagasin(entree, { ...alertesParDefaut, baisseTickets: 0.1, baissePanier: 0.07 })).toEqual([])
  // Un mois sans tickets l'an dernier au Bar : pas d'alerte au Bar, la Cave reste
  const trou = n1.map((x, i) => (i === 4 ? mois([1_000, 40_000], [0, 8_000]) : x))
  expect(alertesMagasin({ ...entree, n1: trou }, alertesParDefaut).map((a) => a.type)).toEqual(['tickets'])
  // Deux mois réalisés seulement : trop tôt
  expect(alertesMagasin({ ...entree, n: [...n.slice(0, 2), ...Array(10).fill(vide)], moisTermines: 2 }, alertesParDefaut)).toEqual([])
})

test('fiche de visite : chiffres à date et les trois sujets où il y a le plus de marge en jeu', () => {
  // Budget : 11 000 € par mois ; marge de cette année 39 % contre 40 % l'an dernier
  const budget = { mois: Array.from({ length: 12 }, () => ({ ca: 11_000 })) } as unknown as Budget
  const n39 = n.map((x) => (x.caHT ? { ...x, margeHT: 3_900 } : x))
  const f = ficheVisite({ n: n39, n1, budget }, { cave: 0.2, bar: 0.18 })
  expect(f).toMatchObject({ mois: 6, ca: 60_000, caBudget: 66_000, caN1: 60_000 })
  proche(f.tauxMarge, 0.39)
  proche(f.tauxMargeN1, 0.4)
  // Cave : 5 700 tickets contre 6 000 ; panier (120 000 + 108 000) / 5 700 = 40 €
  expect(f.univers.cave).toEqual({ tickets: 5_700, ticketsN1: 6_000, panier: 40, panierN1: 40, mois: 6, evolutionTickets: expect.closeTo(-0.05, 9), evolutionPanier: 0 })
  expect(f.univers.bar).toEqual({ tickets: 3_000, ticketsN1: 3_000, panier: 15, panierN1: 16, mois: 6, evolutionTickets: 0, evolutionPanier: -0.0625 })
  proche(f.ecartBudget, 60_000 / 66_000 - 1)
  expect(f.evolution).toBe(0)
  proche(f.ecartMarge, -0.01)
  // Marge en jeu, au taux de 39 % :
  //   tickets Cave : 300 tickets × 40 € TTC / 1,2 × 0,39 = 3 900
  //   CA sous le budget : 6 000 × 0,39 = 2 340
  //   panier Bar : 1 € × 3 000 tickets / 1,18 × 0,39 = 991,53
  //   marge : 1 point × 60 000 = 600, quatrième, écartée
  expect(f.sujets.map((s) => s.type)).toEqual(['tickets', 'ca', 'panier'])
  proche(f.sujets[0].enJeu, 3_900)
  proche(f.sujets[0].ecart, -0.05)
  proche(f.sujets[1].enJeu, 2_340)
  proche(f.sujets[1].ecart, 60_000 / 66_000 - 1)
  proche(f.sujets[2].enJeu, 3_000 / 1.18 * 0.39)
  // Tout en hausse : aucun sujet
  expect(ficheVisite({ n: n1, n1: n1.map((x) => ({ ...x, caHT: 9_000 })), budget: null }, { cave: 0.2, bar: 0.18 }).sujets).toEqual([])
  // Aucun réel
  expect(ficheVisite({ n: Array(12).fill(vide), n1, budget }, { cave: 0.2, bar: 0.18 })).toMatchObject({ mois: 0, ca: 0, caBudget: null, sujets: [] })
})

test('leviers commerciaux : gain de CA, de marge et d’EBE sur un an', () => {
  // Cave : 400 000 € de CA visé à 30 % de marge, panier 40 € TTC ; Bar : 200 000 € à 70 %, panier réalisé 15 €
  const b = {
    familles: [
      { univers: 'cave', objectif: 300_000, margeObjectif: 90_000 }, { univers: 'cave', objectif: 100_000, margeObjectif: 30_000 },
      { univers: 'bar', objectif: 200_000, margeObjectif: 140_000 }, { univers: 'epicerie', objectif: 50_000, margeObjectif: 15_000 },
    ],
    flux: { cave: { panierObjectifTTC: 40, panierRealiseTTC: 38 }, bar: { panierObjectifTTC: 0, panierRealiseTTC: 15 } },
  } as unknown as Budget
  const base = baseLeviers(b)
  expect(base).toEqual({ cave: { ca: 400_000, tauxMarge: 0.3, panierTTC: 40 }, bar: { ca: 200_000, tauxMarge: 0.7, panierTTC: 15 } })
  const p = { tauxRedevance: 0.02, tauxPublicite: 0.01 }
  // Cave : +2 % de tickets, +1 € de panier (+2,5 %), +0,5 point de mix : 400 000 × 1,02 × 1,025 = 418 200 € ;
  // marge 418 200 × 30,5 % = 127 551 €, soit +7 551 € ; EBE : 7 551 − 3 % × 18 200 = 7 005 €
  const e = effetLeviers(base, { cave: { tickets: 0.02, panier: 1, mix: 0.005 }, bar: AUCUN_LEVIER }, p)
  proche(e.univers.cave!.ca, 18_200)
  proche(e.univers.cave!.marge, 7_551)
  expect(e.univers.bar).toEqual({ ca: 0, marge: 0 })
  proche(e.ca, 18_200)
  proche(e.marge, 7_551)
  proche(e.ebe, 7_005)
  // Bar : +1,50 € de panier sur 15 € : +10 %, 20 000 € de CA et 14 000 € de marge
  const bar = effetLeviers(base, { bar: { tickets: 0, panier: 1.5, mix: 0 } }, p)
  proche(bar.ca, 20_000)
  proche(bar.marge, 14_000)
  proche(bar.ebe, 13_400)
})

test('campagne des budgets : retard après la date de proposition ou de validation, avancement par responsable', () => {
  const c = campagneParDefaut(2027)
  expect(c).toEqual({ proposition: '2026-11-15', retour: '2026-12-05', validation: '2026-12-19' })
  expect(enRetard(null, c, '2026-11-15')).toBe(false)              // le jour même : pas encore
  expect(enRetard(null, c, '2026-11-16')).toBe(true)
  expect(enRetard('propose', c, '2026-12-19')).toBe(false)
  expect(enRetard('en_discussion', c, '2026-12-20')).toBe(true)
  expect(enRetard('valide', c, '2027-01-10')).toBe(false)
  const a = avancementCampagne([
    { statut: null, responsables: ['RR Nord'] },
    { statut: 'valide', responsables: ['RR Nord'] },
    { statut: 'en_discussion', responsables: ['RR Sud', 'RR Nord'] },
    { statut: 'propose', responsables: [] },
  ], c, '2026-12-20')
  expect(a).toEqual([
    { nom: 'RR Nord', magasins: 3, aProposer: 1, proposes: 0, enDiscussion: 1, valides: 1, enRetard: 2 },
    { nom: 'RR Sud', magasins: 1, aProposer: 0, proposes: 0, enDiscussion: 1, valides: 0, enRetard: 1 },
    { nom: '', magasins: 1, aProposer: 0, proposes: 1, enDiscussion: 0, valides: 0, enRetard: 1 },
  ])
})

test('effet d’une saisie sur l’EBE : frais et masse salariale au-dessus de l’EBE', async () => {
  const { ebeApres, fraisDeLAnnee } = await import('../../src/moteur/effets')
  // 12 000 € par an et 1 % de 600 000 € de CA : 18 000 €
  expect(fraisDeLAnnee({ annuel: 12_000, taux: 0.01 }, 600_000)).toBe(18_000)
  // EBE de 60 000 € ; les frais passent de 18 000 à 21 000 € : 57 000 €
  expect(ebeApres(60_000, 18_000, 21_000)).toBe(57_000)
})

test('espace franchisé : le budget à relire porte la date de validation de la campagne', async () => {
  const { tachesFranchise } = await import('../../src/lib/aFaire')
  const t = tachesFranchise({ moisRenseignes: 9, quadrimestres: { 2026: [1, 2] }, budget: { annee: 2027, statut: 'propose', avant: '2026-12-19' }, aEquipe: true, aFrais: true }, new Date(2026, 9, 28))
  expect(t).toEqual([{ type: 'budget', annee: 2027, statut: 'propose', avant: '2026-12-19' }])
})

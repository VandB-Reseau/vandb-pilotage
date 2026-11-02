import { expect, test } from '@playwright/test'
import { changementsCibles, effetsChangements, pointsAvantValidation } from '../../src/moteur/changements'
import { ecartExplique } from '../../src/moteur/ecartExplique'
import { chercher, cheminsVersEbe, leviersDuBudget } from '../../src/moteur/objectifEbe'
import { actionSerie, controlesFiche, ebeComplet, ecartAtterrissage, ficheComplete } from '../../src/moteur/preparation'
import { maSemaine } from '../../src/moteur/semaine'
import type { Cibles } from '../../src/moteur/cibles'
import type { Suivi } from '../../src/moteur/suivi'
import type { Budget } from '../../src/moteur/types'
import type { FicheVisite } from '../../src/moteur/visite'
import { MOIS_LONGS } from '../../src/lib/format'

// Lot 41 « budget plus fluide » (Joseph, 02/11/2026). Magasin fictif, chiffres ronds vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number, chiffres = 6) => expect(v).toBeCloseTo(attendu, chiffres)

test('fiche prête à proposer et action de la proposition en série', () => {
  const complet = { reel: true, ouverture: true, equipe: true, frais: true }
  expect(ficheComplete(complet)).toBe(true)
  const sansEquipe = { ...complet, equipe: false }
  expect(controlesFiche(sansEquipe).filter((c) => !c.fait).map((c) => c.cle)).toEqual(['equipe'])
  expect(ebeComplet(sansEquipe)).toBe(false)
  // Atterrissage 612 000 € pour une proposition faite sur 600 000 € : + 2 %, pas au-delà
  proche(ecartAtterrissage(600_000, 612_000), 0.02)
  expect(ecartAtterrissage(null, 612_000)).toBeNull()
  expect(actionSerie(null, null, complet)).toEqual({ action: 'proposer', coche: true })
  expect(actionSerie(null, null, sansEquipe)).toEqual({ action: 'proposer', coche: false })
  expect(actionSerie('propose', 0.02, complet)).toEqual({ action: 'mettre_a_jour', coche: false })     // 2 % pile : pas coché
  expect(actionSerie('propose', -0.025, complet)).toEqual({ action: 'mettre_a_jour', coche: true })
  expect(actionSerie('en_discussion', 0.1, complet)).toEqual({ action: 'mettre_a_jour', coche: false }) // jamais d'office
  expect(actionSerie('valide', 0.1, complet)).toEqual({ action: 'aucune', coche: false })
})

test('changements du magasin face au siège, effet de chacun sur l’EBE et points avant validation', () => {
  const siege: Cibles = { evolutionFlux: { cave: 0.02 }, hausseSalaires: 0.02 }
  const magasin: Cibles = { evolutionFlux: { cave: 0.04, bar: 0.01 }, hausseSalaires: 0.02, margeFamille: { 'cave/Bière': 0.35 }, tresorerieDepart: 30_000 }
  const l = changementsCibles(siege, magasin)
  expect(l.map((c) => [c.cle, c.libelle, c.avant, c.apres])).toEqual([
    ['evolutionFlux/bar', 'Tickets Bar', undefined, 0.01],
    ['evolutionFlux/cave', 'Tickets Cave', 0.02, 0.04],
    ['margeFamille/cave/Bière', 'Marge visée Bière (Cave)', undefined, 0.35],
    ['tresorerieDepart', 'Trésorerie au 1er janvier', undefined, 30_000],
  ])
  // Chaque changement s'applique seul à la position du siège
  expect(l[1].cibles).toEqual({ evolutionFlux: { cave: 0.04 }, hausseSalaires: 0.02 })
  // EBE fictif : 100 000 € + 200 000 € par point de tickets Cave + 100 000 € par point de tickets Bar
  const ebe = (c: Cibles) => 100_000 + 2_000_000 * (c.evolutionFlux?.cave ?? 0) + 1_000_000 * (c.evolutionFlux?.bar ?? 0)
  const r = effetsChangements(siege, magasin, l, ebe)
  expect(r.ebeSiege).toBe(140_000)                            // 100 000 + 2 000 000 × 2 %
  expect(r.ebeMagasin).toBe(190_000)                          // 100 000 + 80 000 + 10 000
  expect(r.effets.map((e) => Math.round(e.effet))).toEqual([10_000, 40_000, 0, 0])
  expect(r.total).toBe(50_000)
  expect(changementsCibles(siege, siege)).toEqual([])

  expect(pointsAvantValidation({ tresorerieDepart: undefined, pointBas: { montant: -5_000, mois: 0 }, changementsNonEnvoyes: true }, MOIS_LONGS).map((p) => p.texte)).toEqual([
    'La trésorerie au 1er janvier n’est pas saisie : le plan de trésorerie part de zéro.',
    'La trésorerie passe sous zéro en janvier (point bas du plan).',
    'Le franchisé a des changements enregistrés qu’il n’a pas encore envoyés.',
  ])
  expect(pointsAvantValidation({ tresorerieDepart: 0, pointBas: { montant: 2_000, mois: 0 }, changementsNonEnvoyes: false }, MOIS_LONGS)).toEqual([])
})

test('objectif d’EBE : valeur de chaque levier qui donne l’EBE visé', () => {
  // EBE linéaire : 50 000 € + 200 000 € par point ; 70 000 € visés → + 10 %
  proche(chercher((x) => 50_000 + 200_000 * x, 70_000), 0.1, 4)
  expect(chercher((x) => 50_000 + 200_000 * x, 400_000)).toBeNull()   // 250 000 € au plus à + 100 %
  const b = {
    ebe: 50_000, personnel: 120_000,
    flux: { cave: { parTickets: true, evolution: 0.02, evolutionPanier: 0.03 }, bar: { parTickets: false } },
    familles: [
      { univers: 'bar', atterrissage: 100_000, evolution: 0.05 }, { univers: 'bar', atterrissage: 300_000, evolution: 0.01 },
      { univers: 'exterieur', atterrissage: 0, evolution: 0 },
    ],
  } as unknown as Budget
  const leviers = leviersDuBudget(b)
  // Bar sans tickets : (100 000 × 5 % + 300 000 × 1 %) ÷ 400 000 = 2 % ; Extérieur sans CA : pas de levier
  expect(leviers.map((l) => [l.cle, l.actuelle])).toEqual([['flux/cave', 0.02], ['panier/cave', 0.03], ['univers/bar', 0.02]])
  // Chaque point au-dessus de la valeur actuelle rapporte 1 000 € d'EBE
  const actuelle = Object.fromEntries(leviers.map((l) => [l.cle, l.actuelle]))
  const ebeAvec = (cle: string, x: number) => 50_000 + 100_000 * (x - actuelle[cle])
  const c = cheminsVersEbe(b, 60_000, ebeAvec)
  expect(c.manque).toBe(10_000)
  expect(c.masseSalariale).toBe(110_000)
  proche(c.leviers[0].valeur, 0.12, 4)                         // 2 % + 10 points
  proche(c.leviers[1].valeur, 0.13, 4)
  const loin = cheminsVersEbe(b, 200_000, ebeAvec)
  expect(loin.masseSalariale).toBeNull()                       // 120 000 − 150 000 < 0
  expect(loin.leviers[0].valeur).toBeNull()                    // il faudrait + 152 %
})

test('d’où vient l’écart : tickets, panier et univers, la somme fait l’écart de CA', () => {
  // Budget : Cave 10 000 €/mois (10 000 tickets sur l'année), Bar 5 000 €/mois, pas d'Extérieur
  const mois = Array.from({ length: 12 }, () => ({ univers: { cave: { ca: 10_000 }, bar: { ca: 5_000 }, exterieur: { ca: 0 } } }))
  const budget = { mois, flux: { cave: { parTickets: true, objectif: 10_000 }, bar: { parTickets: false, objectif: 0 } } } as unknown as Budget
  // Réel à fin février : Cave 22 000 € et 1 800 tickets, Bar 9 000 €
  const lignes = [
    { mois: 1, univers: 'cave', famille: 'Vin', caHT: 11_000, caTTC: null, margeHT: null }, { mois: 2, univers: 'cave', famille: 'Vin', caHT: 11_000, caTTC: null, margeHT: null },
    { mois: 1, univers: 'bar', famille: 'Bière', caHT: 4_500, caTTC: null, margeHT: null }, { mois: 2, univers: 'bar', famille: 'Bière', caHT: 4_500, caTTC: null, margeHT: null },
  ] as const
  const tickets = [{ mois: 1, univers: 'cave', tickets: 900 }, { mois: 2, univers: 'cave', tickets: 900 }] as const
  const suivi = { moisRealises: 2, cumul: { ecartCA: 1_000, ecartMarge: null, tauxMargeBudget: 0.4 }, mois: [{ margeReel: null }, { margeReel: null }] } as unknown as Suivi
  const e = ecartExplique([...lignes], [...tickets], budget, suivi)!
  // Tickets budgétés : 10 000 × 20 000 ÷ 120 000 = 1 666,67 ; effet tickets = 20 000 × (1 800 ÷ 1 666,67 − 1) = 1 600 €
  expect(e.ca.map((x) => [x.cle, Math.round(x.effet)])).toEqual([['tickets/cave', 1_600], ['panier/cave', 400], ['ca/bar', -1_000]])
  expect(e.ecartCA).toBe(1_000)
  proche(e.marge.effetCA, 400)                                 // 1 000 € × 40 % de marge budgétée
  expect(e.marge.effetTaux).toBeNull()
  // Un reste hors univers va au dernier effet
  const reste = ecartExplique([...lignes], [...tickets], budget, { ...suivi, cumul: { ...suivi.cumul, ecartCA: 1_050 } } as Suivi)!
  proche(reste.ca[2].effet, -950)
  // Budget sans détail par univers : un seul effet
  const sans = ecartExplique([...lignes], [...tickets], { ...budget, mois: mois.map(() => ({})) } as unknown as Budget, suivi)!
  expect(sans.ca).toEqual([{ cle: 'ca', libelle: 'Chiffre d’affaires', effet: 1_000 }])
})

test('« Ma semaine » : à appeler dès une alerte, une action en retard ou 1 000 € de marge en jeu', () => {
  const fiche = (...enJeu: number[]) => ({ sujets: enJeu.map((v) => ({ type: 'ca', ecart: -0.1, enJeu: v })) }) as unknown as FicheVisite
  const l = maSemaine([
    { magasin: 'Valcourt', coach: 'Coach Sud', fiche: fiche(999) },
    { magasin: 'Brionne-sur-Lac', coach: 'Coach Nord', fiche: fiche(1_000) },
    { magasin: 'Saint-Aubin-des-Prés', coach: 'Coach Nord', fiche: fiche(10) },
    { magasin: 'Mirecourt', coach: 'Coach Nord', fiche: fiche() },
  ], [{ magasin: 'Saint-Aubin-des-Prés' }], [{ magasin: 'Mirecourt', statut: 'a_faire', echeance: '2026-10-01' }], '2026-11-02')
  expect(l.map((x) => [x.magasin, x.aAppeler])).toEqual([
    ['Brionne-sur-Lac', true], ['Saint-Aubin-des-Prés', true], ['Mirecourt', true], ['Valcourt', false],
  ])
})

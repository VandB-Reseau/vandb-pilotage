import { expect, test } from '@playwright/test'
import { effetEbeDuCA, impactBudget, libelleDernier, suivreDernier, tauxSurCA } from '../../src/moteur/impact'
import type { Budget, LigneFrais } from '../../src/moteur/types'

// Panneau Impact et colonne Effet en EBE (Joseph, 03/11/2026). Chaque résultat est vérifié à la main.

test('effet sur l’EBE d’un gain de CA : marge de l’univers moins ce qui se paie en part du CA', () => {
  const frais: LigneFrais[] = [
    { code: 'loyer', libelle: 'Loyer', rubrique: 'charges_externes', annuel: 36_000 },
    { code: 'cb', libelle: 'Commissions carte', rubrique: 'charges_externes', tauxCA: 0.005 },
  ]
  // Redevance 2 % + publicité 1 % + commissions 0,5 % = 3,5 % ; le loyer ne dépend pas du CA
  const surCA = tauxSurCA(frais, { tauxRedevance: 0.02, tauxPublicite: 0.01 })
  expect(surCA).toBeCloseTo(0.035, 10)
  // 10 000 € de CA Cave à 36 % de marge : 3 600 € − 350 € = 3 250 € d'EBE
  expect(effetEbeDuCA(10_000, 0.36, surCA)).toBeCloseTo(3_250, 6)
  expect(effetEbeDuCA(null, 0.36, surCA)).toBeNull()
  // Une baisse de CA retire autant
  expect(effetEbeDuCA(-4_000, 0.74, 0.03)).toBeCloseTo(-2_840, 6)
})

test('indicateurs du panneau : valeur, écart à la référence, taux et point bas', () => {
  const budget = (ca: number, marge: number, personnel: number, ebe: number, resultatNet: number) =>
    ({ ca, marge, tauxMarge: marge / ca, personnel, ebe, resultatNet, ratios: { pctFP: personnel / ca, ebeSurCA: ebe / ca } }) as unknown as Budget
  const avant = budget(600_000, 330_000, 180_000, 60_000, 30_000)
  const apres = budget(612_000, 334_320, 180_000, 63_960, 32_970)
  const l = impactBudget(apres, avant, { pointBas: { montant: -5_000, mois: 0 } }, { pointBas: { montant: -8_000, mois: 0 } })
  const de = (c: string) => l.find((i) => i.cle === c)!
  expect(de('ca').ecart).toBe(12_000)
  expect(de('marge').ecart).toBeCloseTo(4_320, 6)
  // 334 320 / 612 000 = 54,627 % contre 55 % : −0,373 point
  expect(de('marge').ecartTaux).toBeCloseTo(-0.003725, 5)
  // % FP : 180 000 / 612 000 = 29,41 % contre 30 % ; la masse salariale qui monte n'est pas une bonne nouvelle
  expect(de('personnel').ecart).toBe(0)
  expect(de('personnel').taux).toBeCloseTo(0.294118, 5)
  expect(de('personnel').hausseFavorable).toBe(false)
  expect(de('ebe').ecart).toBe(3_960)
  expect(de('resultatNet').ecart).toBe(2_970)
  expect(de('pointBas').ecart).toBe(3_000)
  expect(de('pointBas').mois).toBe(0)
  // Sans trésorerie, pas de point bas
  expect(impactBudget(apres, avant).map((i) => i.cle)).toEqual(['ca', 'marge', 'personnel', 'ebe', 'resultatNet'])
})

test('dernier changement : les frappes dans un même champ n’en font qu’un, un autre champ en ouvre un nouveau', () => {
  const enregistre = {}
  const t1 = { evolutionFlux: { cave: 0.01 } }
  const t12 = { evolutionFlux: { cave: 0.12 } }
  const p = { evolutionFlux: { cave: 0.12 }, evolutionPanier: { cave: 0.02 } }
  // Premier changement : avant lui, ce qui est enregistré
  let avant = suivreDernier(null, enregistre, t1, enregistre)
  expect(avant).toEqual({})
  // « 1 » puis « 12 » : toujours le même changement
  avant = suivreDernier(avant, t1, t12, enregistre)
  expect(avant).toEqual({})
  // Le panier : un nouveau changement, qui part des tickets à 12 %
  avant = suivreDernier(avant, t12, p, enregistre)
  expect(avant).toEqual(t12)
  // Rien ne bouge : on garde
  expect(suivreDernier(avant, p, p, enregistre)).toEqual(t12)
  // Annuler le dernier : on revient à t12, plus de dernier changement
  expect(suivreDernier(avant, p, t12, enregistre)).toBeNull()
  // Retour à ce qui est enregistré : rien
  expect(suivreDernier(avant, p, enregistre, enregistre)).toBeNull()
})

test('libellé du dernier changement', () => {
  expect(libelleDernier({}, { evolutionFlux: { cave: 0.02 } })).toBe('Tickets Cave')
  // La marge visée d'un univers écrit chaque famille : un seul libellé
  expect(libelleDernier({}, { margeFamille: { 'cave/Vins': 0.38, 'cave/Bières': 0.38 } })).toBe('Marge visée Cave')
  expect(libelleDernier({}, { evolutionFlux: { cave: 0.02 }, hausseSalaires: 0.02 })).toBe('2 hypothèses')
  expect(libelleDernier({}, {})).toBe('')
})

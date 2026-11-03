import { expect, test } from '@playwright/test'
import { etatCalendrier, etatEquipe, etatInvestissements, etatFrais, marquerRienPrevu, reponseQuestion, resumeUnivers, saisiesQuestion } from '../../src/moteur/questions'
import { ebePourRemuneration } from '../../src/moteur/economie'
import { changementsCibles } from '../../src/moteur/changements'
import type { Cibles } from '../../src/moteur/cibles'
import type { Budget, ResultatFamille } from '../../src/moteur/types'

// Joseph (03/11/2026) : cartes qui disent ce qu'il reste à faire, simulateur unique. Chiffres ronds vérifiés à la main.

test('Évènements & Temps forts : deux questions ; Investissements & Financements : trois (03/11/2026)', () => {
  const vide: Cibles = {}
  expect(etatCalendrier(vide)).toBe('aFaire')
  expect(etatInvestissements(vide)).toBe('aFaire')
  expect(reponseQuestion(vide, 'travaux')).toBe('aRepondre')
  // Travaux saisis : la question des travaux a sa réponse, quelle que soit la fermeture
  const travaux: Cibles = { travaux: { activite: [1, 1, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0, investissement: 0, dureeAmortissement: 5 } as Cibles['travaux'] }
  expect(saisiesQuestion(travaux, 'travaux')).toBe(1)
  expect(reponseQuestion(travaux, 'travaux')).toBe('saisie')
  // Achats et emprunts : un emprunt et un apport font deux réponses
  const achats: Cibles = { ...travaux, investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 18000, mois: 3, duree: 5 }] }
  expect(saisiesQuestion(achats, 'investissements')).toBe(1)
  const finance = { ...achats, emprunts: [{ libelle: 'Prêt', montant: 60000, taux: 0.04, duree: 7, premiereEcheance: 8 }], apport: { montant: 5000, mois: 2 } }
  expect(saisiesQuestion(finance, 'emprunts')).toBe(2)
  expect(etatInvestissements(finance)).toBe('fait')
  // Le Calendrier ne pose plus la question des travaux : deux « Rien de prévu » suffisent
  const fait = marquerRienPrevu(marquerRienPrevu(vide, 'tempsForts', true), 'ajustementsCA', true)
  expect(fait.rienPrevu).toEqual(['tempsForts', 'ajustementsCA'])
  expect(etatCalendrier(fait)).toBe('fait')
  expect(marquerRienPrevu(fait, 'emprunts', true).rienPrevu).toEqual(['emprunts', 'tempsForts', 'ajustementsCA'])
  // Annuler la réponse : la question revient ; liste vide retirée des ajustements
  const annule = marquerRienPrevu(marquerRienPrevu(fait, 'tempsForts', false), 'ajustementsCA', false)
  expect('rienPrevu' in annule).toBe(false)
  expect(etatCalendrier(annule)).toBe('aFaire')
  // « Rien de prévu » n'est pas un changement d'hypothèse face au siège
  expect(changementsCibles({}, { rienPrevu: ['travaux'] })).toEqual([])
})

test('équipe et frais : à faire, à vérifier (repris des comptes) ou fait', () => {
  expect(etatEquipe(true, false)).toBe('aFaire')
  expect(etatEquipe(true, true)).toBe('aVerifier')
  expect(etatEquipe(false, false)).toBe('fait')
  expect(etatFrais(false, true)).toBe('aVerifier')
  expect(etatFrais(true, false)).toBe('aFaire')
  expect(etatFrais(false, false)).toBe('fait')
})

test('carte d’un univers : CA de départ et budgété, tickets et panier, marge visée', () => {
  const f = (univers: 'cave' | 'exterieur', atterrissage: number, objectif: number, margeCible: number, evolution: number) =>
    ({ univers, famille: 'x', atterrissage, objectif, margeCible, evolution }) as unknown as ResultatFamille
  // Cave 400 000 → 420 000 (+5 %) ; marge visée (210 000 × 40 % + 210 000 × 30 %) ÷ 420 000 = 35 %
  // Extérieur 50 000 → 55 000, évolution moyenne pondérée (20 000 × 0 + 30 000 × 1/6) ÷ 50 000 = 10 %
  const b = {
    familles: [f('cave', 200_000, 210_000, 0.4, 0), f('cave', 200_000, 210_000, 0.3, 0), f('exterieur', 20_000, 20_000, 0.2, 0), f('exterieur', 30_000, 35_000, 0.2, 1 / 6)],
    flux: { cave: { parTickets: true, evolution: 0.02, evolutionPanier: 0.0294 } },
  } as unknown as Budget
  const [cave, ext] = resumeUnivers(b)
  expect(cave.univers).toBe('cave')
  expect(cave.depart).toBe(400_000)
  expect(cave.ca).toBe(420_000)
  expect(cave.ecart).toBeCloseTo(0.05, 10)
  expect(cave.tickets).toBe(0.02)
  expect(cave.panier).toBe(0.0294)
  expect(cave.marge).toBeCloseTo(0.35, 10)
  expect(ext.univers).toBe('exterieur')
  expect(ext.tickets).toBeUndefined()
  expect(ext.evolution).toBeCloseTo(0.1, 10)
  expect(ext.ca).toBe(55_000)
})

test('simulateur : viser une rémunération du gérant, c’est viser l’EBE qui la paie', () => {
  // EBE 60 000 €, gérant 30 000 € ; viser 45 000 € pour le gérant demande 75 000 € d'EBE avant sa rémunération actuelle
  expect(ebePourRemuneration(60_000, { gerant: 30_000 }, 45_000)).toBe(75_000)
  expect(ebePourRemuneration(60_000, { gerant: 30_000 }, 20_000)).toBe(50_000)
})

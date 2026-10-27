import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { appliquerCibles } from '../../src/moteur/cibles'
import { coefficientReduction, coutPersonne, masseSalariale, moisPresents, type Personne } from '../../src/moteur/equipe'
import { chargesParDefaut, parametresParDefaut } from '../../src/moteur/parametres'
import { champsDepuisPersonne, lirePersonne, nouvellePersonne } from '../../src/moteur/saisieEquipe'
import { magasinFictif } from '../donnees-fictives'

// Équipe fictive, montants ronds : chaque résultat se vérifie à la main (détail en commentaire). Paramètres 2026 par défaut :
// SMIC annuel 21 876,40 €, réduction Tmin 0,02, Tdelta 0,3781, puissance 1,75 ; employé 35 %, gérant TNS 33 %.
const SMIC = 21_876.4
const r = chargesParDefaut.reduction
const proche = (valeur: number, attendu: number, decimales = 2) => expect(valeur).toBeCloseTo(attendu, decimales)
const vendeur = (p: Partial<Personne>): Personne => ({ poste: 'Vendeur 1', categorie: 'employe', heuresHebdo: 35, brutMensuel: SMIC / 12, primes: [], entree: null, sortie: null, ...p })

test('coefficient de la réduction générale : maximal au SMIC, dégressif, nul à 3 SMIC', () => {
  expect(coefficientReduction(SMIC, SMIC, r)).toBe(0.3981)
  // 1,5 SMIC : 0,02 + 0,3781 × (½ × (2 − 1))^1,75 = 0,02 + 0,3781 × 0,29730
  expect(coefficientReduction(1.5 * SMIC, SMIC, r)).toBe(0.1324)
  // 2 SMIC : 0,02 + 0,3781 × 0,25^1,75 = 0,02 + 0,3781 × 0,08839
  expect(coefficientReduction(2 * SMIC, SMIC, r)).toBe(0.0534)
  expect(coefficientReduction(3 * SMIC, SMIC, r)).toBe(0)
  // Sous le SMIC (apprenti), le coefficient reste plafonné
  expect(coefficientReduction(0.6 * SMIC, SMIC, r)).toBe(0.3981)
})

test('un vendeur au SMIC ne garde que les charges hors réduction ; à 1,5 SMIC, 35 % − 13,24 %', () => {
  // Réduction plafonnée aux cotisations couvertes : 35 % − 1,23 % = 33,77 %
  const smic = coutPersonne(vendeur({}), chargesParDefaut, 2026)
  expect(smic.coefficient).toBe(0.3377)
  proche(smic.tauxEffectif, 0.0123, 6)
  proche(smic.coutAnnuel, SMIC * 1.0123)
  proche(smic.etp, 1, 6)
  // 1,5 SMIC à temps plein, entré en juillet : SMIC de référence ramené à 6 mois
  const v2 = coutPersonne(vendeur({ poste: 'Vendeur 2', brutMensuel: 1.5 * SMIC / 12, entree: '2026-07' }), chargesParDefaut, 2026)
  expect(v2.brut.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
  proche(v2.brutAnnuel, 0.75 * SMIC)
  expect(v2.coefficient).toBe(0.1324)
  proche(v2.coutAnnuel, 0.75 * SMIC * (1 + 0.35 - 0.1324))
  proche(v2.etp, 0.5, 6)
  // Mi-temps au SMIC horaire : même coefficient qu'un temps plein au SMIC
  expect(coutPersonne(vendeur({ heuresHebdo: 17.5, brutMensuel: SMIC / 24 }), chargesParDefaut, 2026).coefficient).toBe(0.3377)
})

test('gérant TNS sans réduction, primes au mois de versement, indexation des salaires seulement', () => {
  // 3 000 € par mois × 12 × 1,33
  const gerant = coutPersonne({ ...vendeur({ poste: 'Gérant', categorie: 'gerant_tns', brutMensuel: 3_000 }) }, chargesParDefaut, 2026)
  expect(gerant.coefficient).toBe(0)
  proche(gerant.coutAnnuel, 47_880)
  // 2 500 € + prime de 1 000 € en décembre, hausse de 2 % : 2 550 × 12 + 1 000 = 31 600 de brut
  const responsable = coutPersonne(vendeur({ poste: 'Responsable', categorie: 'agent_maitrise', brutMensuel: 2_500, primes: [{ mois: 12, montant: 1_000 }] }), chargesParDefaut, 2027, 0.02)
  proche(responsable.brutAnnuel, 31_600)
  proche(responsable.brut[11], 3_550)
  // Une sortie en mars : présent de janvier à mars
  expect(moisPresents({ entree: null, sortie: '2026-03' }, 2026).filter(Boolean)).toHaveLength(3)
  expect(moisPresents({ entree: '2027-02', sortie: null }, 2026).filter(Boolean)).toHaveLength(0)
})

test('masse salariale de l’équipe et budget : le personnel vient de l’équipe, hausse comprise', () => {
  const equipe = [vendeur({}), vendeur({ poste: 'Gérant', categorie: 'gerant_tns', brutMensuel: 3_000 })]
  const m = masseSalariale(equipe, chargesParDefaut, 2027)
  proche(m.cout, SMIC * 1.0123 + 47_880)
  proche(m.parMois[0].heures, 2 * 35 * 52 / 12, 6)
  proche(m.etp, 2, 6)
  const { hypotheses } = appliquerCibles({ ...magasinFictif, equipe }, [{ niveau: 'reseau', cibles: { hausseSalaires: 0.02 } }])
  expect(hypotheses.hausseSalaires).toBe(0.02)
  const b = calculerBudget(hypotheses, parametresParDefaut)
  proche(b.personnel, masseSalariale(equipe, chargesParDefaut, 2027, 0.02).cout)
  // Sans équipe, le calcul du personnel ne change pas (12 × 12 000 + 4 000 × 1,5 × 12)
  proche(calculerBudget(magasinFictif, parametresParDefaut).personnel, 216_000)
})

test('saisie d’une personne : montants à la française, contrôles lisibles, poste proposé', () => {
  expect(nouvellePersonne([vendeur({}), vendeur({ poste: 'Gérant' })]).poste).toBe('Vendeur 2')
  const lu = lirePersonne({ poste: ' Vendeur 2 ', categorie: 'employe', heuresHebdo: '24', brutMensuel: '1 400,50', primes: [{ mois: 12, montant: '300' }, { mois: 6, montant: '' }], entree: '2027-03', sortie: '' })
  expect(lu.personne).toEqual({ id: undefined, poste: 'Vendeur 2', categorie: 'employe', heuresHebdo: 24, brutMensuel: 1400.5, primes: [{ mois: 12, montant: 300 }], entree: '2027-03', sortie: null })
  expect(champsDepuisPersonne(lu.personne!).brutMensuel).toBe('1400,5')
  expect(lirePersonne({ poste: '', categorie: 'gerant_tns', heuresHebdo: '80', brutMensuel: '', primes: [{ mois: 1, montant: 'x' }], entree: '2027-05', sortie: '2027-01' }).erreurs).toEqual([
    'Le poste est à renseigner.', 'Les heures par semaine sont à renseigner (entre 0 et 70).', 'La rémunération mensuelle est à renseigner.',
    'Le montant d’une prime est illisible.', 'Le départ est avant l’arrivée.',
  ])
})

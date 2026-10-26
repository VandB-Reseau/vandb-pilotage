import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { appliquerCibles, ecarts, ecrireCible, lireCible, valeurHeritee, type NiveauCibles } from '../../src/moteur/cibles'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { magasinFictif } from '../donnees-fictives'

// Le magasin fictif sert de base : son réalisé (CA, marge, salaires, frais), ses objectifs étant fixés par les niveaux.
const proche = (valeur: number, attendu: number) => expect(valeur).toBeCloseTo(attendu, 6)

const reseau: NiveauCibles = { niveau: 'reseau', cibles: { evolutionUnivers: { cave: 0.03, bar: 0.03, exterieur: 0 }, hausseSalaires: 0.02, inflationFrais: 0.02, margeFamille: { 'bar/Fût': 0.75 } } }
const groupe: NiveauCibles = { niveau: 'groupe', cibles: { evolutionUnivers: { bar: 0.08 } } }
const magasin: NiveauCibles = { niveau: 'magasin', cibles: { evolutionFamille: { 'cave/Bière': 0.05 } } }

test('chaque valeur vient du niveau le plus proche du magasin qui la renseigne', () => {
  const { hypotheses: h, provenance } = appliquerCibles(magasinFictif, [reseau, groupe, magasin])
  const [biere, fut, evenements] = h.familles
  proche(biere.evolution, 0.05)      // magasin
  proche(fut.evolution, 0.08)        // groupe, prime sur le réseau
  proche(evenements.evolution, 0)    // réseau
  proche(fut.margeCible, 0.75)       // réseau
  proche(biere.margeCible, 0.36)     // aucune cible : la marge réalisée du magasin
  const source = (cle: string) => provenance.find((p) => p.cle === cle)?.source
  expect(source('evolution/cave/Bière')).toBe('magasin')
  expect(source('evolution/bar/Fût')).toBe('groupe')
  expect(source('marge/cave/Bière')).toBe('base')
  expect(ecarts(provenance).map((p) => p.libelle)).toEqual(['Évolution du CA Bière (Cave)'])
})

test('hausse des salaires et inflation des frais annuels ; les frais en % du CA suivent le CA', () => {
  const { hypotheses: h } = appliquerCibles(magasinFictif, [reseau])
  proche(h.personnel.salairesMensuels[0], 12_240)                // 12 000 × 1,02
  proche(h.personnel.remunerationGerance, 4_000)                 // la gérance reste celle saisie
  proche(h.frais.find((l) => l.code === 'loyer')!.annuel!, 61_200) // 60 000 × 1,02
  expect(h.frais.find((l) => l.code === 'energie')).toEqual(magasinFictif.frais.find((l) => l.code === 'energie'))
})

test('sans aucune cible, le budget reconduit le réalisé du magasin à l’identique', () => {
  const { hypotheses: h } = appliquerCibles(magasinFictif, [{ niveau: 'reseau', cibles: null }])
  const b = calculerBudget(h, parametresParDefaut)
  // Évolution nulle : CA = atterrissage = 600 000 ; marge = 200 000 × 36 % + 300 000 × 74 % + 100 000 × 40 %
  proche(b.ca, 600_000)
  proche(b.marge, 72_000 + 222_000 + 40_000)
  proche(h.personnel.salairesMensuels[5], 12_000)
})

test('un budget complet par niveaux : CA et EBE vérifiés à la main', () => {
  const { hypotheses: h } = appliquerCibles(magasinFictif, [reseau, groupe, magasin])
  const b = calculerBudget(h, parametresParDefaut)
  // CA : 200 000 × 1,05 + 300 000 × 1,08 + 100 000 = 210 000 + 324 000 + 100 000
  proche(b.ca, 634_000)
  // Marge : 210 000 × 36 % + 324 000 × 75 % + 100 000 × 40 % = 75 600 + 243 000 + 40 000
  proche(b.marge, 358_600)
  // Charges externes : 3 % × 634 000 + loyer 61 200 + énergie 1,3 % × 634 000 + honoraires 6 120 = 19 020 + 61 200 + 8 242 + 6 120
  proche(b.chargesExternes, 94_582)
  // Impôts et taxes : CFE 3 060 ; personnel : 12 × (12 240 + 4 000 × 1,5) = 218 880
  proche(b.impotsTaxes, 3_060)
  proche(b.personnel, 218_880)
  proche(b.ebe, 358_600 - 94_582 - 3_060 - 218_880)
})

test('une cible se lit, s’écrit et s’efface par sa clé ; effacée, le niveau du dessus reprend la main', () => {
  let c = ecrireCible({}, 'evolution/cave/Bière', 0.04)
  c = ecrireCible(c, 'hausseSalaires', 0.01)
  expect(lireCible(c, 'evolution/cave/Bière')).toBe(0.04)
  expect(lireCible(c, 'hausseSalaires')).toBe(0.01)
  c = ecrireCible(c, 'evolution/cave/Bière', undefined)
  expect(lireCible(c, 'evolution/cave/Bière')).toBeUndefined()
  expect(valeurHeritee([reseau, groupe], 'univers/bar')).toEqual({ valeur: 0.08, source: 'groupe' })
  expect(valeurHeritee([reseau, groupe], 'hausseSalaires')).toEqual({ valeur: 0.02, source: 'reseau' })
})

test('l’évolution héritée d’une famille reprend celle de son univers', () => {
  expect(valeurHeritee([reseau, groupe], 'evolution/bar/Fût')).toEqual({ valeur: 0.08, source: 'groupe' })
  expect(valeurHeritee([reseau], 'evolution/cave/Bière')).toEqual({ valeur: 0.03, source: 'reseau' })
})

import { expect, test } from '@playwright/test'
import { fraisDepuisLignes } from '../../src/moteur/atterrissage'
import { calculerBudget } from '../../src/moteur/budget'
import { compteResultat } from '../../src/moteur/compteResultat'
import { ligneFraisDuCompte } from '../../src/moteur/fec'
import { blocDe, lignesFrais, parametresParDefaut } from '../../src/moteur/parametres'
import { magasinFictif } from '../donnees-fictives'

// Frais dans les blocs de l'onglet FFBUD (lot 23), sur le magasin fictif : chaque résultat se vérifie à la main.

test('grille : lignes de l’onglet FFBUD dans ses blocs, codes uniques', () => {
  expect(new Set(lignesFrais.map((l) => l.code)).size).toBe(lignesFrais.length)
  expect(lignesFrais.filter((l) => l.bloc === 'charges_externes')).toHaveLength(30)   // 31 lignes moins la publicité franchise, calculée
  expect(lignesFrais.filter((l) => l.bloc === 'impots_taxes').map((l) => l.code)).toEqual(['formation_continue', 'taxe_apprentissage', 'cfe', 'taxes_foncieres', 'enregistrement', 'taxes_diverses', 'csg_gc', 'csg_ac'])
  expect(lignesFrais.filter((l) => l.bloc === 'autres_charges').map((l) => l.code)).toEqual(['droits_auteur', 'charges_diverses'])
  // Ligne hors de la grille : bloc d'après sa rubrique
  expect(blocDe({ code: 'ancienne', rubrique: 'impots_taxes' })).toBe('impots_taxes')
  expect(blocDe({ code: 'ancienne', rubrique: 'autres' })).toBe('charges_externes')
})

test('intérêts et charges assimilées : emprunts, comptes courants et agios', () => {
  const l = (code: string, annuel: number) => ({ code, libelle: code, rubrique: 'hors_exploitation', annuel, tauxCA: null })
  const { finances } = fraisDepuisLignes([l('interets', 1_200), l('interets_comptes_courants', 300), l('agios', 50), l('amortissements', 24_000)])
  expect(finances).toEqual({ amortissements: 24_000, interets: 1_550, remboursementCapital: 0 })
})

test('compte de résultat : autres charges à part, au-dessus de l’EBE ; royalties et publicité franchise dans les charges externes', () => {
  const h = { ...magasinFictif, frais: [...magasinFictif.frais, { code: 'droits_auteur', libelle: 'Droits d’auteur', rubrique: 'autres' as const, annuel: 3_600 }] }
  const b = calculerBudget(h, parametresParDefaut)
  const lignes = compteResultat(b, h, parametresParDefaut)
  const total = (cle: string) => lignes.find((x) => x.cle === cle)!.total
  // CA 640 000 : loyer 60 000 + énergie 1,3 % (8 320) + honoraires 6 000 + publicité 1 % (6 400) + royalties 2 % (12 800)
  expect(total('externes')).toBeCloseTo(-93_520, 6)
  expect(total('autres')).toBeCloseTo(-3_600, 6)
  expect(lignes.find((x) => x.cle === 'externes/redevance')!.libelle).toBe('Royalties')
  expect(lignes.findIndex((x) => x.cle === 'autres')).toBeLessThan(lignes.findIndex((x) => x.cle === 'ebe'))
  // L'EBE ne bouge pas de place : 3 600 € de moins qu'avant
  expect(b.ebe).toBeCloseTo(calculerBudget(magasinFictif, parametresParDefaut).ebe - 3_600, 6)
})

test('FEC : ligne de frais d’un compte, la plus longue racine l’emporte', () => {
  expect(ligneFraisDuCompte('613200')).toBe('Locations immobilières')
  expect(ligneFraisDuCompte('613500')).toBe('Locations mobilières')
  expect(ligneFraisDuCompte('622600')).toBe('Honoraires divers')
  expect(ligneFraisDuCompte('622610')).toBe('Honoraires de comptabilité')
  expect(ligneFraisDuCompte('635110')).toBe('Cotisation foncière des entreprises')
  expect(ligneFraisDuCompte('637800')).toBe('Taxes diverses')
  expect(ligneFraisDuCompte('651100')).toBe('Royalties')
  expect(ligneFraisDuCompte('661600')).toBe('Agios')
  expect(ligneFraisDuCompte('607000')).toBeNull()   // achats de marchandises
  expect(ligneFraisDuCompte('641000')).toBeNull()   // personnel
  expect(ligneFraisDuCompte('411000')).toBeNull()   // pas une charge
})

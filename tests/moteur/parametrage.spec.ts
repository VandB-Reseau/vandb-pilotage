import { expect, test } from '@playwright/test'
import { decrireChangement, libelleRubrique } from '../../src/lib/parametrage'

// Journal des paramètres réseau (lot 39) : chaque ligne enregistrée par la base se lit en clair
const t = (s: string) => s.replace(/[  ]/g, ' ')

test('une valeur seule : avant → après', () => {
  expect(libelleRubrique('tauxRedevance')).toBe('Redevance franchise')
  expect(t(decrireChangement('tauxRedevance', 0.02, 0.025))).toBe('2,0 % → 2,5 %')
  expect(t(decrireChangement('tauxPublicite', null, 0.01))).toBe('par défaut → 1,0 %')
})

test('une rubrique à plusieurs valeurs : seules celles qui changent', () => {
  const avant = { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 }
  expect(t(decrireChangement('impot', avant, { ...avant, plafondTauxReduit: 50000 }))).toBe('plafond du taux réduit : 42 500 € → 50 000 €')
  expect(t(decrireChangement('tresorerie', { delaiFournisseurs: 1, tvaTrimestrielle: false, consignes: { achats: { bar: 0.15 } } },
    { delaiFournisseurs: 2, tvaTrimestrielle: true, consignes: { achats: { bar: 0.2 } } })))
    .toBe('paiement des fournisseurs (mois) : 1 → 2 ; TVA trimestrielle : non → oui ; consignes Bar : 15,0 % → 20,0 %')
  expect(decrireChangement('charges', { taux: { a: 1, b: 2, c: 3, d: 4 } }, { taux: { a: 5, b: 6, c: 7, d: 8 } })).toBe('4 valeurs modifiées')
  expect(decrireChangement('campagne', { proposition: '2026-11-15' }, { proposition: '2026-11-20' })).toBe('proposition : 15/11/2026 → 20/11/2026')
})

test('lot 40 : grille des frais ligne par ligne, règles de calcul complétées par défaut', async () => {
  const { lignesFrais, nouvelleLigneGrille } = await import('../../src/moteur/parametres')
  const energie = lignesFrais.find((l) => l.code === 'energie')!
  const grille = lignesFrais.map((l) => (l.code === 'energie' ? { ...l, libelle: 'Électricité et eau', racines: ['6061', '6062'] } : l.code === 'carburant' ? { ...l, masquee: true } : l))
  expect(libelleRubrique('grilleFrais')).toBe('Grille des frais')
  expect(decrireChangement('grilleFrais', null, grille))
    .toBe(`${energie.libelle} renommée « Électricité et eau » ; Électricité et eau : comptes 6061 → 6061, 6062 ; Carburant masquée`)
  const ajout = nouvelleLigneGrille(lignesFrais, 'Musique d’ambiance', 'autres')
  expect(decrireChangement('grilleFrais', grille, [...grille, ajout])).toBe('ligne ajoutée : Musique d’ambiance')
  expect(decrireChangement('grilleFrais', grille, null)).toBe('Électricité et eau renommée « Électricité, eau, gaz » ; Électricité, eau, gaz : comptes 6061, 6062 → 6061 ; Carburant réaffichée')
  // Règles : rien d'enregistré avant, une seule valeur changée
  expect(t(decrireChangement('regles', null, { jeuneMagasin: 24 }))).toBe('montée en charge (mois) : 18 → 24')
  expect(t(decrireChangement('regles', { ecartRythme: 0.2 }, null))).toBe('écart du rythme suivi d’office : 20,0 % → 15,0 %')
})

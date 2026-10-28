import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { appliquerCibles, ecarts } from '../../src/moteur/cibles'
import { compteResultat } from '../../src/moteur/compteResultat'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { magasinFictif } from '../donnees-fictives'

// Saisonnalité propre au magasin, démarque par famille, travaux : chaque résultat se vérifie à la main.
// Magasin fictif sans cible : 640 000 € de CA (Bière 210 000, Fût 330 000, Événements 100 000), marge 367 300 €,
// saisonnalité 7,5 % de janvier à août, 10 % de septembre à décembre, amortissements 24 000 €.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const sans = calculerBudget(magasinFictif, parametresParDefaut)

test('saisonnalité du magasin : ramenée à 100 %, le CA de l’année ne change pas', () => {
  const b = calculerBudget({ ...magasinFictif, poidsMois: Array(12).fill(1) }, parametresParDefaut)
  proche(b.ca, 640_000)
  proche(b.poids[0], 1 / 12)
  proche(b.mois[0].ca, 640_000 / 12)
  proche(b.mois[11].ca, 640_000 / 12)
  // Saisie invalide : on garde la saisonnalité de référence
  proche(calculerBudget({ ...magasinFictif, poidsMois: [1, 2] }, parametresParDefaut).mois[0].ca, 48_000)
})

test('démarque par famille : déduite de la marge visée, le CA ne bouge pas', () => {
  const b = calculerBudget({ ...magasinFictif, familles: magasinFictif.familles.map((f) => (f.famille === 'Bière' ? { ...f, demarque: 0.02 } : f)) }, parametresParDefaut)
  proche(b.ca, 640_000)
  proche(b.familles[0].margeObjectif, 75_600)           // 210 000 × (38 % − 2 %)
  proche(b.marge, 363_100)                              // 367 300 − 4 200
  proche(sans.marge - b.marge, 4_200)
})

test('travaux : fermeture, activité réduite, gain après réouverture, investissement amorti dès la réouverture', () => {
  // Janvier fermé, février à moitié, puis +10 % ; 60 000 € amortis sur 5 ans
  const travaux = { activite: [0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0.1, investissement: 60_000, dureeAmortissement: 5 }
  const b = calculerBudget({ ...magasinFictif, travaux }, parametresParDefaut)
  // Part ouverte : 7,5 % × 0 + 7,5 % × 0,5 + 7,5 % × 1,1 × 6 + 10 % × 1,1 × 4 = 0,9725
  proche(b.ca, 622_400)
  proche(b.familles[0].objectif, 204_225)               // 210 000 × 0,9725
  proche(b.mois[0].ca, 0)
  proche(b.mois[1].ca, 24_000)                          // 640 000 × 7,5 % × 0,5
  proche(b.mois[2].ca, 52_800)                          // 640 000 × 7,5 % × 1,1
  proche(b.mois[8].ca, 70_400)                          // 640 000 × 10 % × 1,1
  // 12 000 € par an, sur les 10 mois après la réouverture : 10 000 €
  proche(b.amortissements, 34_000)
  proche(b.resultatExploitation, b.ebe - 34_000)
  const lignes = compteResultat(b, { ...magasinFictif, travaux }, parametresParDefaut)
  proche(lignes.find((l) => l.cle === 'amortissements')?.total, -34_000)
  // Détail par univers : même répartition que le CA du mois
  proche(lignes.filter((l) => l.parent === 'ca').reduce((a, l) => a + (l.mois[1] ?? 0), 0), 24_000)
})

test('cibles : saisonnalité, travaux et démarque du magasin comptent comme des écarts', () => {
  const travaux = { activite: Array(12).fill(1), gain: 0, investissement: 0, dureeAmortissement: 0 }
  const { hypotheses, provenance } = appliquerCibles(magasinFictif, [
    { niveau: 'reseau', cibles: { demarqueFamille: { 'bar/Fût': 0.01 } } },
    { niveau: 'magasin', cibles: { poidsMois: Array(12).fill(1), travaux, demarqueFamille: { 'cave/Bière': 0.02 } } },
  ])
  expect(hypotheses.poidsMois).toHaveLength(12)
  expect(hypotheses.travaux).toEqual(travaux)
  expect(hypotheses.familles.map((f) => f.demarque)).toEqual([0.02, 0.01, 0])
  expect(ecarts(provenance).map((p) => p.libelle)).toEqual(['Démarque Bière (Cave)', 'Saisonnalité du magasin', 'Travaux'])
  expect(provenance.find((p) => p.cle === 'demarque/bar/Fût')?.source).toBe('reseau')
})

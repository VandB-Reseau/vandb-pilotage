import { expect, test } from '@playwright/test'
import { baseDepuisReel, fraisDepuisLignes } from '../../src/moteur/atterrissage'
import { calculerBudget } from '../../src/moteur/budget'
import { ajouterLigne, lignesDisponibles, lireSaisieFrais, saisieDepuisLignes, totauxFrais } from '../../src/moteur/saisieFrais'
import { parametresParDefaut } from '../../src/moteur/parametres'
import type { LigneReel } from '../../src/moteur/reel'

// Magasin fictif aux chiffres ronds : chaque résultat se vérifie à la main (calcul en commentaire).
const n: LigneReel[] = [
  { mois: 1, univers: 'cave', famille: 'Bière', caHT: 10_000, caTTC: 12_000, margeHT: 3_600 },
  { mois: 2, univers: 'cave', famille: 'Bière', caHT: 20_000, caTTC: 24_000, margeHT: 7_200 },
  { mois: 1, univers: 'bar', famille: 'Fût', caHT: 10_000, caTTC: 12_000, margeHT: 7_400 },
]
// Cave N-1 : 1 000 par mois, 4 000 en décembre (15 000 sur l'année) ; pas de Bar en N-1
const n1: LigneReel[] = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Vin', caHT: i === 11 ? 4_000 : 1_000, caTTC: null, margeHT: null }))
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('atterrissage : mois restants sur la saisonnalité de l’univers en N-1, ou sur la moyenne réalisée', () => {
  const r = baseDepuisReel({ n: { lignes: n, tickets: [{ mois: 1, univers: 'cave', tickets: 600 }] }, n1: { lignes: n1, tickets: [] } }, 2026)!
  expect(r.moisRealises).toBe(2)
  expect(r.methode).toBe('saisonnalite')
  proche(r.realise, 40_000)
  // Cave : 2 000 sur 15 000 réalisés à fin février en N-1 ; Bar sans N-1 : 2 mois sur 12
  proche(r.base.partRealisee!.cave!, 2_000 / 15_000)
  proche(r.base.partRealisee!.bar!, 2 / 12)
  // Mars : Bière 15 000 (moyenne) × 1 000 / 1 000 + Fût 5 000 ; décembre : 15 000 × 4 + 5 000
  proche(r.parMois[2].ca, 20_000)
  proche(r.parMois[11].ca, 65_000)
  expect(r.parMois[1].projete).toBe(false)
  expect(r.parMois[2].projete).toBe(true)
  // Bière 30 000 / (2 000 / 15 000) = 225 000 ; Fût 10 000 × 12 / 2 = 60 000
  proche(r.parMois.reduce((a, x) => a + x.ca, 0), 285_000)
  // Panier : 12 000 TTC de janvier pour 600 tickets (février, sans tickets, n'entre pas)
  expect(r.base.flux?.cave).toEqual({ realise: 600, evolution: 0, panierCibleTTC: 20 })

  // Le moteur du budget, sans évolution, retombe sur l'atterrissage : CA 285 000, marge 225 000 × 36 % + 60 000 × 74 %
  const b = calculerBudget(r.base, parametresParDefaut)
  proche(b.ca, 285_000)
  proche(b.marge, 81_000 + 44_400)
  proche(b.mois[11].ca, 65_000)

  // Sans N-1 : moyenne des mois réalisés (40 000 sur 2 mois → 240 000 sur l'année)
  const plat = baseDepuisReel({ n: { lignes: n, tickets: [] }, n1: { lignes: [], tickets: [] } }, 2026)!
  expect(plat.methode).toBe('moyenne')
  proche(calculerBudget(plat.base, parametresParDefaut).ca, 240_000)
  expect(baseDepuisReel({ n: { lignes: [], tickets: [] }, n1: { lignes: n1, tickets: [] } }, 2026)).toBeNull()
})

test('frais du magasin : lignes annuelles ou en % du CA, emprunts et amortissements à part', () => {
  const { frais, finances } = fraisDepuisLignes([
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, tauxCA: null },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: null, tauxCA: 0.013 },
    { code: 'amortissements', libelle: 'Dotations aux amortissements', rubrique: 'hors_exploitation', annuel: 24_000, tauxCA: null },
    { code: 'interets', libelle: 'Intérêts d’emprunts', rubrique: 'hors_exploitation', annuel: 1_200, tauxCA: null },
  ])
  expect(frais).toEqual([
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000 },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', tauxCA: 0.013 },
  ])
  expect(finances).toEqual({ amortissements: 24_000, interets: 1_200, remboursementCapital: 0 })
})

test('saisie des frais : lignes de la grille, part du CA en %, lignes vidées retirées, totaux par rubrique', () => {
  const avant = [
    { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, tauxCA: null },
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: null, tauxCA: 0.013 },
    { code: 'telecom', libelle: 'Frais postaux et télécom', rubrique: 'autres', annuel: 1_200, tauxCA: null },
    { code: 'interets', libelle: 'Intérêts d’emprunts', rubrique: 'hors_exploitation', annuel: 1_200, tauxCA: null },
  ]
  let s = saisieDepuisLignes(avant)
  // Ordre de la grille du réseau : énergie, puis loyer, puis télécom
  expect(s.lignes.map((l) => [l.code, l.mode, l.valeur])).toEqual([['energie', 'taux', '1,3'], ['loyer', 'annuel', '60000'], ['telecom', 'annuel', '1200']])
  expect(s.finances).toEqual({ amortissements: '', interets: '1200', remboursementCapital: '' })
  s = ajouterLigne(s, 'charges_locatives')
  expect(lignesDisponibles(s).some((l) => l.code === 'charges_locatives')).toBe(false)
  s = { ...s, lignes: s.lignes.map((l) => (l.code === 'charges_locatives' ? { ...l, valeur: '6 000' } : l.code === 'telecom' ? { ...l, valeur: '' } : l)) }
  const t = totauxFrais(s)
  expect(t.parRubrique.immobilier).toEqual({ annuel: 66_000, taux: 0 })
  expect(t.annuel).toBe(66_000)
  expect(t.taux).toBeCloseTo(0.013, 9)
  const lu = lireSaisieFrais(s, avant)
  expect(lu.erreurs).toEqual([])
  expect(lu.retirees).toEqual(['telecom'])
  expect(lu.lignes.find((l) => l.code === 'charges_locatives')).toEqual({ code: 'charges_locatives', libelle: 'Charges locatives', rubrique: 'immobilier', annuel: 6_000, tauxCA: null })
  expect(lu.lignes.find((l) => l.code === 'energie')?.tauxCA).toBeCloseTo(0.013, 9)
  expect(lireSaisieFrais({ ...s, lignes: [{ ...s.lignes[0], valeur: '120' }] }, []).erreurs).toEqual(['Électricité, eau, gaz : montant illisible.'])
})

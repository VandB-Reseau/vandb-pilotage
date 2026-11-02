import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { changementsEquipe } from '../../src/moteur/changementsEquipe'
import { compteResultat } from '../../src/moteur/compteResultat'
import { appliquerCibles } from '../../src/moteur/cibles'
import { coutPersonne, type Personne } from '../../src/moteur/equipe'
import { fraisDuBudget, lignesFraisBudget } from '../../src/moteur/fraisBudget'
import { chargesParDefaut, parametresParDefaut } from '../../src/moteur/parametres'
import { lirePersonne, champsDepuisPersonne } from '../../src/moteur/saisieEquipe'
import { magasinFictif } from '../donnees-fictives'

// Lot 35 : hausses de salaire datées, changements de l'équipe dans l'année, frais du budget ligne par ligne.
// Chiffres vérifiés à la main. Un cadre à 6 000 € brut par mois dépasse 3 SMIC : pas de réduction générale, son coût
// est son brut × 1,365 (charges cadre 36,5 %).
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const cadre = (p: Partial<Personne> = {}): Personne => ({ id: 1, poste: 'Responsable', categorie: 'cadre', heuresHebdo: 35, brutMensuel: 6_000, primes: [], entree: null, sortie: null, ...p })

test('hausse datée : appliquée à partir de son mois, cumulée avec la hausse générale et avec les autres', () => {
  const p = cadre({ hausses: [{ mois: '2027-04', taux: 0.05 }] })
  const c = coutPersonne(p, chargesParDefaut, 2027)
  proche(c.brut[2], 6_000)                      // mars : avant la hausse
  proche(c.brut[3], 6_300)                      // avril : + 5 %
  proche(c.brutAnnuel, 3 * 6_000 + 9 * 6_300)   // 74 700 €
  proche(c.coutAnnuel, 74_700 * 1.365)          // 101 965,50 €
  // Hausse générale de 2 % en plus : 6 120 € puis 6 426 €
  proche(coutPersonne(p, chargesParDefaut, 2027, 0.02).brutAnnuel, 3 * 6_120 + 9 * 6_426) // 76 194 €
  // Deux hausses : + 5 % en avril puis + 2 % en octobre, soit 6 426 € d'octobre à décembre
  const deux = coutPersonne(cadre({ hausses: [{ mois: '2027-04', taux: 0.05 }, { mois: '2027-10', taux: 0.02 }] }), chargesParDefaut, 2027)
  proche(deux.brut[9], 6_426)
  proche(deux.brutAnnuel, 3 * 6_000 + 6 * 6_300 + 3 * 6_426) // 75 078 €
  // Une hausse de 2027 ne touche pas 2026 ; une hausse de 2026 compte toute l'année 2027
  proche(coutPersonne(p, chargesParDefaut, 2026).brutAnnuel, 72_000)
  proche(coutPersonne(cadre({ hausses: [{ mois: '2026-07', taux: 0.05 }] }), chargesParDefaut, 2027).brutAnnuel, 75_600)
})

test('changements de l’équipe dans l’année, dans l’ordre des mois, avec leur effet sur la masse salariale', () => {
  const equipe = [
    cadre({ hausses: [{ mois: '2027-04', taux: 0.05 }], primes: [{ mois: 12, montant: 1_000 }] }),
    cadre({ id: 2, poste: 'Adjoint', entree: '2027-07' }),
    cadre({ id: 3, poste: 'Vendeur 1', sortie: '2027-09' }),
  ]
  const l = changementsEquipe(equipe, chargesParDefaut, 2027, 0.02)
  expect(l.map((x) => `${x.mois} ${x.type} ${x.poste}`)).toEqual([
    '1 hausse_generale Toute l’équipe', '4 hausse Responsable', '7 arrivee Adjoint', '9 depart Vendeur 1', '12 prime Responsable',
  ])
  // Hausse générale : (76 194 − 74 700) × 1,365 pour le Responsable (primes non indexées), 6 et 9 mois × 120 € × 1,365 pour les autres
  proche(l[0].effet, (76_194 - 74_700) * 1.365 + 6 * 120 * 1.365 + 9 * 120 * 1.365) // 4 496,31 €
  proche(l[1].effet, (76_194 - 73_440) * 1.365)   // + 5 % en avril, sur 6 120 € : 3 759,21 €
  proche(l[2].effet, 6 * 6_120 * 1.365)           // arrivée en juillet : 6 mois, 50 122,80 €
  proche(l[3].effet, -3 * 6_120 * 1.365)          // départ après septembre : 3 mois en moins, − 25 061,40 €
  proche(l[4].effet, 1_000 * 1.365)               // prime de décembre : 1 365 €
  // Sans hausse générale, pas de ligne pour elle
  expect(changementsEquipe(equipe, chargesParDefaut, 2027).some((x) => x.type === 'hausse_generale')).toBe(false)
})

test('saisie des hausses : en %, vides ignorées, triées par mois', () => {
  const champs = { ...champsDepuisPersonne(cadre()), hausses: [{ mois: '2027-10', taux: '2' }, { mois: '2027-04', taux: '2,5' }, { mois: '2027-06', taux: '' }] }
  expect(lirePersonne(champs).personne?.hausses).toEqual([{ mois: '2027-04', taux: 0.025 }, { mois: '2027-10', taux: 0.02 }])
  expect(lirePersonne({ ...champs, hausses: [{ mois: '2027-04', taux: 'beaucoup' }] }).erreurs).toEqual(['Une hausse de salaire est illisible (entre −50 % et 100 %).'])
  expect(champsDepuisPersonne(cadre({ hausses: [{ mois: '2027-04', taux: 0.025 }] })).hausses).toEqual([{ mois: '2027-04', taux: '2,5' }])
})

test('frais du budget : même montant, hausse en %, nouveau montant ; inflation par défaut', () => {
  const choix = {
    loyer: { mode: 'meme' as const },
    honoraires_comptables: { mode: 'taux' as const, valeur: 0.1 },
    telecom: { mode: 'montant' as const, valeur: 900 },          // ligne nouvelle au budget
    remboursementCapital: { mode: 'montant' as const, valeur: 36_000 },
  }
  const l = lignesFraisBudget(magasinFictif, choix, 0.02)
  const de = (code: string) => l.find((x) => x.code === code)!
  proche(de('loyer').apres, 60_000)                   // même montant
  proche(de('honoraires_comptables').apres, 6_600)    // + 10 %
  proche(de('cfe').apres, 3_060)                      // sans choix : inflation de 2 %
  expect(de('cfe').parDefaut).toBe(true)
  proche(de('energie').tauxCA!, 0.013)                // en part du CA : le taux reste
  proche(de('telecom').avant, 0)
  proche(de('telecom').apres, 900)
  proche(de('amortissements').apres, 24_000)          // sous l'EBE : même montant par défaut
  proche(de('remboursementCapital').apres, 36_000)
  const f = fraisDuBudget(magasinFictif, choix, 0.02)
  expect(f.frais.map((x) => x.code)).toEqual(['loyer', 'energie', 'honoraires_comptables', 'cfe', 'telecom'])
  proche(f.frais.reduce((a, x) => a + (x.annuel ?? 0), 0), 60_000 + 6_600 + 3_060 + 900) // 70 560 €
  proche(f.remboursementCapital, 36_000)
  proche(f.interets, 1_200)
})

test('frais du budget : seuls les choix du magasin comptent, l’inflation vient des niveaux', () => {
  const { hypotheses: h } = appliquerCibles(magasinFictif, [
    { niveau: 'reseau', cibles: { inflationFrais: 0.03, fraisBudget: { loyer: { mode: 'montant', valeur: 1 } } } },
    { niveau: 'magasin', cibles: { fraisBudget: { honoraires_comptables: { mode: 'montant', valeur: 7_000 } } } },
  ])
  proche(h.frais.find((x) => x.code === 'loyer')!.annuel!, 61_800)   // choix du réseau ignoré : inflation 3 %
  proche(h.frais.find((x) => x.code === 'honoraires_comptables')!.annuel!, 7_000)
  proche(h.remboursementCapital, 30_000)
})

test('compte de résultat : charges externes détaillées par thème, puis ligne par ligne', () => {
  const h = { ...magasinFictif, frais: [...magasinFictif.frais, { code: 'charges_locatives', libelle: 'Charges locatives', rubrique: 'immobilier' as const, annuel: 6_000 }] }
  const lignes = compteResultat(calculerBudget(h, parametresParDefaut), h, parametresParDefaut)
  const l = (cle: string) => lignes.find((x) => x.cle === cle)!
  expect(l('externes/theme/immobilier').parent).toBe('externes')
  proche(l('externes/theme/immobilier').total, -66_000)          // loyer 60 000 + charges locatives 6 000
  expect(l('externes/loyer').parent).toBe('externes/theme/immobilier')
  expect(l('externes/redevance').parent).toBe('externes/theme/reseau')
  expect(lignes.some((x) => x.cle === 'externes/theme/communication')).toBe(false) // thème sans ligne : absent
})

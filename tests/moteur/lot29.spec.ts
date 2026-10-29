import { expect, test } from '@playwright/test'
import { caPourRemuneration, economieFranchise } from '../../src/moteur/economie'
import { famillesFaceAuReseau } from '../../src/moteur/familles'
import { maSemaine, parCoach } from '../../src/moteur/semaine'
import type { Budget, Famille, Hypotheses } from '../../src/moteur/types'
import type { FicheVisite } from '../../src/moteur/visite'

// Lot 29 : économie du franchisé, familles face au réseau, « Ma semaine ». Chiffres simples, vérifiés à la main.
const proche = (v: number | null | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

test('économie du franchisé : point mort, marge de sécurité, gérant, CA pour une rémunération visée', () => {
  // CA 600 000 €, marge 240 000 €, redevance 2 % et publicité 1 %, frais à 1 % du CA ; résultat avant impôt 30 000 €
  const b = { ca: 600_000, marge: 240_000, redevance: 12_000, publicite: 6_000, resultatAvantImpot: 30_000, tresorerieDegagee: 20_000 } as Budget
  const h = {
    annee: 2027, frais: [{ code: 'energie', libelle: 'Énergie', rubrique: 'energies', tauxCA: 0.01 }, { code: 'loyer', libelle: 'Loyer', rubrique: 'immobilier', annuel: 48_000 }],
    personnel: { remunerationGerance: 2_000, tauxCotisationsGerance: 0.45 },
  } as unknown as Hypotheses
  const e = economieFranchise(b, h, { charges: {} as never })
  // Marge sur coûts variables : 240 000 − 12 000 − 6 000 − 6 000 = 216 000, soit 36 % ; fixes 216 000 − 30 000 = 186 000
  expect(e.mcv).toBe(216_000)
  proche(e.tauxMCV, 0.36)
  expect(e.fixes).toBe(186_000)
  proche(e.pointMort, 186_000 / 0.36)                    // 516 666,67 €
  proche(e.margeSecurite, (600_000 - 186_000 / 0.36) / 600_000)
  expect(e.gerant).toBe(34_800)                          // 2 000 × 12 × 1,45, sans équipe saisie
  expect(e.resteDisponible).toBe(20_000)
  // Gérant porté à 46 800 € : 12 000 € de fixes en plus, 12 000 / 0,36 = 33 333 € de CA en plus
  proche(caPourRemuneration(e, 46_800)?.ca, 600_000 + 12_000 / 0.36)
  proche(caPourRemuneration(e, 46_800)?.ecart, 12_000 / 0.36 / 600_000)
  // Marge sur coûts variables négative : pas de point mort
  const perte = economieFranchise({ ...b, marge: 10_000 }, h, { charges: {} as never })
  expect(perte.pointMort).toBeNull()
  expect(caPourRemuneration(perte, 46_800)).toBeNull()
})

test('familles face au réseau : poids médian, famille absente à 0 %, potentiel de marge', () => {
  const f = (famille: string, caRealise: number, taux: number, univers: Famille['univers'] = 'cave'): Famille =>
    ({ univers, famille, caRealise, margeRealisee: caRealise * taux, evolution: 0, margeCible: taux })
  // Ce magasin : Cave 100 000 €, épicerie 3 % à 40 % de marge, vin 97 % à 30 %
  const moi = [f('Épicerie', 3_000, 0.4), f('Vin', 97_000, 0.3)]
  // Réseau : épicerie à 6 %, 8 % et 10 % ; un magasin sans épicerie (0 %) ; le magasin lui-même
  const reseau = [moi, [f('Épicerie', 6_000, 0.42), f('Vin', 94_000, 0.3)], [f('Épicerie', 8_000, 0.38), f('Vin', 92_000, 0.3)],
    [f('Épicerie', 10_000, 0.4), f('Vin', 90_000, 0.3)], [f('Vin', 50_000, 0.3)]]
  const l = famillesFaceAuReseau(moi, reseau)
  const epicerie = l.find((x) => x.famille === 'Épicerie')!
  // Poids : 3 %, 6 %, 8 %, 10 %, 0 % → médiane 6 % ; taux : 40 %, 42 %, 38 %, 40 % → médiane 40 %
  expect(epicerie).toMatchObject({ poids: 0.03, magasins: 5 })
  proche(epicerie.medianePoids, 0.06)
  proche(epicerie.medianeTaux, 0.4)
  // Potentiel : 3 points × 100 000 € × (40 % − 30 %) = 300 €
  proche(epicerie.potentiel, 300)
  expect(l[0].famille).toBe('Épicerie')                  // le plus de potentiel d'abord
  const vin = l.find((x) => x.famille === 'Vin')!
  expect(vin.potentiel).toBeNull()                       // au-dessus de la médiane
  // Une famille que le magasin n'a pas : poids 0, potentiel au taux médian
  const sans = famillesFaceAuReseau([f('Vin', 100_000, 0.3)], reseau).find((x) => x.famille === 'Épicerie')!
  expect(sans.poids).toBe(0)
  proche(sans.potentiel, 0.06 * 100_000 * (0.4 - 0.3))   // 600 €
  // Moins de 3 magasins : pas de médiane
  expect(famillesFaceAuReseau(moi, reseau.slice(0, 2))[0].medianePoids).toBeNull()
})

test('« Ma semaine » : magasins par marge en jeu, regroupés par Coach', () => {
  const fiche = (...enJeu: number[]) => ({ sujets: enJeu.map((v) => ({ type: 'ca', ecart: -0.1, enJeu: v })) }) as unknown as FicheVisite
  const l = maSemaine([
    { magasin: 'Valcourt', coach: 'Coach Sud', fiche: fiche(4_000) },
    { magasin: 'Brionne-sur-Lac', coach: 'Coach Nord', fiche: fiche(10_000, 5_000, 3_000) },
    { magasin: 'Saint-Aubin-des-Prés', coach: 'Coach Nord', fiche: fiche() },
  ], [{ magasin: 'Brionne-sur-Lac' }, { magasin: 'Brionne-sur-Lac' }], [
    { magasin: 'Valcourt', statut: 'a_faire', echeance: '2026-10-01' },
    { magasin: 'Valcourt', statut: 'a_faire', echeance: '2026-12-01' },     // pas encore échue
    { magasin: 'Valcourt', statut: 'faite', echeance: '2026-09-01' },       // faite
  ], '2026-10-28')
  expect(l.map((x) => [x.magasin, x.enJeu, x.alertes.length, x.actionsEnRetard])).toEqual([
    ['Brionne-sur-Lac', 18_000, 2, 0], ['Valcourt', 4_000, 0, 1], ['Saint-Aubin-des-Prés', 0, 0, 0],
  ])
  expect(l[0].sujet?.enJeu).toBe(10_000)
  expect(l[2].sujet).toBeNull()
  expect(parCoach(l)).toEqual([
    { coach: 'Coach Nord', magasins: 2, aSuivre: 1, enJeu: 18_000, alertes: 2, actionsEnRetard: 0 },
    { coach: 'Coach Sud', magasins: 1, aSuivre: 1, enJeu: 4_000, alertes: 0, actionsEnRetard: 1 },
  ])
})

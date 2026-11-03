import { expect, test } from '@playwright/test'
import { alertesMagasin, alertesParDefaut, type EntreeAlertes } from '../../src/moteur/alertes'
import { baseDepuisReel, saisonnaliteMediane } from '../../src/moteur/atterrissage'
import { compteResultat } from '../../src/moteur/compteResultat'
import { fraisDepuisFEC, ligneFraisDuCompte } from '../../src/moteur/fec'
import { famillesFaceAuReseau } from '../../src/moteur/familles'
import { lignesFraisBudget } from '../../src/moteur/fraisBudget'
import {
  alignerSurGrille, blocDe, completerGrille, controlerGrille, lignesCourantes, lignesFrais, lireComptes, nouvelleLigneGrille,
} from '../../src/moteur/parametres'
import { reglesDe, reglesHorsBornes, reglesParDefaut } from '../../src/moteur/regles'
import { ajouterLigne, LIGNES_COURANTES, lignesDisponibles, saisieDepuisLignes } from '../../src/moteur/saisieFrais'
import type { LigneReel } from '../../src/moteur/reel'
import type { MoisReel } from '../../src/moteur/suivi'
import type { Budget, Famille, Hypotheses, LigneGrille } from '../../src/moteur/types'

// Lot 40 : grille des frais et règles de calcul modifiables depuis Paramètres réseau. Magasin fictif aux chiffres ronds,
// chaque résultat se vérifie à la main (calcul en commentaire). Données fictives : dépôt public.
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)

// Grille du Directeur : énergie renommée, carburant masqué, une ligne ajoutée avec le compte 6062, assurances en tête
const ajout = nouvelleLigneGrille(lignesFrais, 'Musique d’ambiance', 'autres')
const maGrille: LigneGrille[] = [
  lignesFrais.find((l) => l.code === 'assurances')!,
  ...lignesFrais.filter((l) => l.code !== 'assurances').map((l) =>
    l.code === 'energie' ? { ...l, libelle: 'Électricité et eau' } : l.code === 'carburant' ? { ...l, masquee: true } : l),
  { ...ajout, racines: ['6062'] },
]

test('grille par défaut : celle de l’onglet FFBUD, sans erreur, avec ses 9 lignes courantes', () => {
  expect(controlerGrille(lignesFrais)).toEqual([])
  expect(LIGNES_COURANTES).toEqual(['energie', 'loyer', 'charges_locatives', 'assurances', 'honoraires_comptables', 'budget_communication', 'telecom', 'banque', 'cfe'])
  // Rien d'enregistré : la grille par défaut ; une grille enregistrée reçoit les lignes par défaut qui lui manquent
  expect(completerGrille(undefined)).toBe(lignesFrais)
  const courte = completerGrille([{ ...lignesFrais[1], libelle: 'Gazole' }])
  expect(courte).toHaveLength(lignesFrais.length)
  expect(courte[0].libelle).toBe('Gazole')
  expect(courte.filter((l) => l.code === 'carburant')).toHaveLength(1)
})

test('nouvelle ligne : code tiré du libellé, unique, bloc d’après le thème', () => {
  expect(ajout).toEqual({ code: 'ajout_musique_d_ambiance', libelle: 'Musique d’ambiance', rubrique: 'autres', bloc: 'charges_externes', racines: [] })
  expect(nouvelleLigneGrille([...lignesFrais, ajout], 'Musique d’ambiance', 'autres').code).toBe('ajout_musique_d_ambiance_2')
  expect(nouvelleLigneGrille(lignesFrais, 'Taxe sur les enseignes', 'impots_taxes').bloc).toBe('impots_taxes')
  expect(lireComptes('6061, 6062 ;6061  6063')).toEqual(['6061', '6062', '6063'])
})

test('contrôles de la grille : libellé vide ou en double, compte hors charges, compte sur deux lignes', () => {
  const g = (o: Partial<LigneGrille>[]) => o.map((x, i) => ({ code: `l${i}`, libelle: `Ligne ${i}`, rubrique: 'autres' as const, bloc: 'charges_externes' as const, racines: [], ...x }))
  expect(controlerGrille(g([{ libelle: ' ' }]))).toEqual(['Chaque ligne a besoin d’un libellé.'])
  expect(controlerGrille(g([{ libelle: 'Loyer' }, { libelle: 'loyer' }]))).toEqual(['Deux lignes s’appellent « loyer ».'])
  expect(controlerGrille(g([{ racines: ['401'] }]))).toEqual(['Ligne 0 : « 401 » n’est pas un compte de charges (6…).'])
  expect(controlerGrille(g([{ racines: ['6061'] }, { racines: ['6061'] }]))).toEqual(['Le compte 6061 est sur deux lignes : Ligne 0 et Ligne 1.'])
  // Une ligne masquée ne compte plus pour les comptes en double
  expect(controlerGrille(g([{ racines: ['6061'] }, { racines: ['6061'], masquee: true }]))).toEqual([])
  expect(controlerGrille(maGrille)).toEqual([])
})

test('saisie des frais avec la grille du réseau : ordre, lignes masquées, lignes courantes, renommage', () => {
  const s = saisieDepuisLignes([
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: 6_000, tauxCA: null },
    { code: 'assurances', libelle: 'Primes d’assurances', rubrique: 'banque_assurances', annuel: 2_400, tauxCA: null },
  ], maGrille)
  // Assurances passées en tête de la grille : en tête de la saisie
  expect(s.lignes.map((l) => l.code)).toEqual(['assurances', 'energie'])
  // Carburant masqué : plus proposé ; la ligne ajoutée l'est, et s'ajoute sous son libellé
  const libres = lignesDisponibles(s, maGrille).map((l) => l.code)
  expect(libres).not.toContain('carburant')
  expect(libres).toContain(ajout.code)
  expect(ajouterLigne(s, ajout.code, maGrille).lignes.at(-1)).toMatchObject({ code: ajout.code, libelle: 'Musique d’ambiance', rubrique: 'autres' })
  // Lignes courantes : celles cochées dans la grille, masquées écartées
  expect(lignesCourantes([...maGrille.map((l) => (l.code === 'loyer' ? { ...l, masquee: true } : l)), { ...ajout, code: 'x', courante: true }])).not.toContain('loyer')
  // Les lignes enregistrées prennent le libellé de la grille ; une ligne hors grille reste telle quelle
  const alignees = alignerSurGrille([
    { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies' },
    { code: 'ancienne', libelle: 'Ligne d’avant', rubrique: 'autres' },
  ], maGrille)
  expect(alignees.map((l) => l.libelle)).toEqual(['Électricité et eau', 'Ligne d’avant'])
})

test('import FEC avec la grille du réseau : comptes ajoutés, lignes masquées hors des frais', () => {
  const e = (compte: string, solde: number) => ({ compte, libelle: `Compte ${compte}`, date: '2026-01-15', solde })
  const ecritures = [e('606200', 1_200), e('606140', 300), e('606100', 500), { ...e('606100', 500), date: '2026-12-15' }]
  // Grille par défaut : 6062 n'est sur aucune ligne, 60614 est le carburant
  const parDefaut = fraisDepuisFEC(ecritures)
  expect(parDefaut.aRanger.map((x) => x.compte)).toEqual(['606200'])
  expect(parDefaut.lignes.find((l) => l.code === 'carburant')?.annuel).toBe(300)
  // Grille du Directeur : 6062 sur la ligne ajoutée ; carburant masqué, 60614 retombe sur l'énergie (6061)
  const f = fraisDepuisFEC(ecritures, maGrille)
  expect(f.mois).toBe(12)
  expect(f.aRanger).toEqual([])
  expect(f.lignes).toEqual([
    { code: 'energie', libelle: 'Électricité et eau', annuel: 1_300, comptes: ['606100', '606140'] },
    { code: ajout.code, libelle: 'Musique d’ambiance', annuel: 1_200, comptes: ['606200'] },
  ])
  expect(ligneFraisDuCompte('606200')).toBeNull()
  expect(ligneFraisDuCompte('606200', maGrille)).toBe('Musique d’ambiance')
})

test('compte de résultat et budget : ordre et bloc de la grille du réseau, ligne nouvelle sous son libellé', () => {
  const h = {
    frais: [
      { code: 'energie', libelle: 'Électricité et eau', rubrique: 'energies', annuel: 1_200 },
      { code: 'assurances', libelle: 'Primes d’assurances', rubrique: 'banque_assurances', annuel: 2_400 },
    ],
    interets: 0, remboursementCapital: 0, amortissements: 0,
  } as unknown as Hypotheses
  const b = {
    ca: 120_000, impot: 0, amortissements: 0, familles: [],
    mois: Array.from({ length: 12 }, () => ({ ca: 10_000, achats: 6_000, marge: 4_000, chargesExternes: 600, impotsTaxes: 0, personnel: 0, ebe: 3_400, resultatExploitation: 3_400, resultatAvantImpot: 3_400 })),
  } as unknown as Budget
  const cles = (p: { grilleFrais?: LigneGrille[] }) => compteResultat(b, h, { tauxRedevance: 0, tauxPublicite: 0, ...p }).filter((l) => /^externes\/(energie|assurances)$/.test(l.cle)).map((l) => l.cle)
  // Les thèmes gardent leur ordre ; dans la liste à plat, la grille donne l'ordre : par défaut l'énergie d'abord
  expect(blocDe({ code: 'energie', rubrique: 'energies' }, maGrille)).toBe('charges_externes')
  expect(cles({})).toEqual(['externes/energie', 'externes/assurances'])
  expect(cles({ grilleFrais: maGrille })).toEqual(['externes/energie', 'externes/assurances'])
  // Ligne nouvelle au budget, absente de la grille de l'année : elle garde le libellé noté au moment du choix
  const l = lignesFraisBudget({ frais: [], amortissements: 0, interets: 0, remboursementCapital: 0 }, { [ajout.code]: { mode: 'montant', valeur: 900, libelle: 'Musique d’ambiance', rubrique: 'autres' } }, 0.02)
  expect(l[0]).toMatchObject({ code: ajout.code, libelle: 'Musique d’ambiance', rubrique: 'autres', apres: 900 })
})

// ── Règles de calcul
const cave = (ca: Record<number, number>): LigneReel[] => Object.entries(ca).map(([mois, caHT]) => ({ mois: Number(mois), univers: 'cave' as const, famille: 'Bière', caHT, caTTC: null, margeHT: caHT * 0.4 }))
const plat = cave(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 10_000])))

test('règles par défaut : celles en service jusqu’ici ; bornes de saisie', () => {
  expect(reglesParDefaut).toEqual({ jeuneMagasin: 18, moisRythme: 4, ecartRythme: 0.15, seuilRythme: 0.15, magasinsSaisonnalite: 3, magasinsCalage: 8, magasinsFamille: 3, moisCommerciaux: 3 })
  expect(reglesDe({ regles: { jeuneMagasin: 24 } as never })).toEqual({ ...reglesParDefaut, jeuneMagasin: 24 })
  expect(reglesHorsBornes(reglesParDefaut)).toEqual([])
  expect(reglesHorsBornes({ ...reglesParDefaut, jeuneMagasin: 40, moisRythme: 2.5, ecartRythme: 0.6 })).toEqual(['jeuneMagasin', 'moisRythme', 'ecartRythme'])
})

test('atterrissage : écart accepté et nombre de mois du rythme réglables', () => {
  const annee = (r: NonNullable<ReturnType<typeof baseDepuisReel>>) => r.parMois.reduce((a, x) => a + x.ca, 0)
  // 30 000 de mai à août : 160 000 réalisés. Saisonnalité plate : 160 000 / (8/12) = 240 000.
  // Rythme des 4 derniers mois : 160 000 + 120 000 = 280 000, + 16,7 % : écarté à 15 %, retenu à 20 %
  const bond = cave({ 1: 10_000, 2: 10_000, 3: 10_000, 4: 10_000, 5: 30_000, 6: 30_000, 7: 30_000, 8: 30_000 })
  const reel = { n: { lignes: bond, tickets: [] }, n1: { lignes: plat, tickets: [] } }
  expect(baseDepuisReel(reel, 2026)!.methodes.cave).toBe('magasin')
  const large = baseDepuisReel(reel, 2026, [], undefined, {}, { ...reglesParDefaut, ecartRythme: 0.2 })!
  expect(large.methodes.cave).toBe('rythme')
  proche(annee(large), 280_000)
  // Rythme sur 2 mois (juillet-août, 60 000 pour 2/12) : 160 000 + 120 000 = 280 000 aussi, fenêtre juillet-août
  const deux = baseDepuisReel(reel, 2026, [], undefined, {}, { ...reglesParDefaut, ecartRythme: 0.2, moisRythme: 2 })!
  expect(deux.rythmes?.cave).toEqual({ de: 7, a: 8, ca: 60_000 })
})

test('atterrissage : seuil du magasin jeune réglable', () => {
  // Ouvert en janvier 2025, réel jusqu'en août 2026 : 20 mois d'activité. Jeune sous 18 mois : non ; sous 24 mois : oui
  const accelere = cave({ 1: 10_000, 2: 10_000, 3: 10_000, 4: 10_000, 5: 12_000, 6: 12_000, 7: 12_000, 8: 12_000 })
  const reel = { n: { lignes: accelere, tickets: [] }, n1: { lignes: plat, tickets: [] } }
  const secours = { ouverture: { annee: 2025, mois: 1 }, saisonnaliteReseau: Array(12).fill(1 / 12) }
  const r = baseDepuisReel(reel, 2026, [], undefined, secours, { ...reglesParDefaut, ecartRythme: 0.01 })!
  expect(r.methodes.cave).toBe('magasin')       // N-1 complet, rythme à + 3 % écarté à 1 %
  const jeune = baseDepuisReel(reel, 2026, [], undefined, secours, { ...reglesParDefaut, ecartRythme: 0.01, jeuneMagasin: 24 })!
  expect(jeune.methodes.cave).toBe('rythme')    // montée en charge : rythme d'office, quel que soit l'écart
})

test('saisonnalité médiane, familles face au réseau, alertes tickets : nombre de magasins et de mois réglables', () => {
  const annees = [Array(12).fill(1), Array(12).fill(2)]
  expect(saisonnaliteMediane(annees)).toBeNull()                 // 2 magasins complets, il en faut 3
  expect(saisonnaliteMediane(annees, 2)).toEqual(Array(12).fill(1 / 12))

  const f = (famille: string, ca: number): Famille => ({ univers: 'cave', famille, caRealise: ca, margeRealisee: ca * 0.4, evolution: 0, margeCible: 0.4 })
  const moi = [f('Vin', 60), f('Bière', 40)], autres = [[f('Vin', 50), f('Bière', 50)], [f('Vin', 70), f('Bière', 30)]]
  expect(famillesFaceAuReseau(moi, autres)[0].medianePoids).toBeNull()       // 2 magasins
  proche(famillesFaceAuReseau(moi, autres, 2)[0].medianePoids!, 0.6)         // (0,5 + 0,7) / 2

  // Cave : 1 000 tickets par mois l'an dernier ; cette année 1 000 de janvier à mai, 800 en juin
  const m = (t: number): MoisReel => ({ caHT: 10_000, margeHT: 4_000, caAvecMarge: 10_000, caTTC: t * 40, tickets: t, univers: { cave: { tickets: t, caTTC: t * 40 }, bar: { tickets: 0, caTTC: 0 } } })
  const vide: MoisReel = { caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }
  const e: EntreeAlertes = {
    magasin: 'Brionne-sur-Lac', n: [...Array.from({ length: 5 }, () => m(1_000)), m(800), ...Array(6).fill(vide)], n1: Array.from({ length: 12 }, () => m(1_000)),
    budget: null, moisTermines: 6, tresorerieReelle: null, tresorerieBudget: null,
  }
  // 3 mois : 2 800 contre 3 000, − 6,7 % : alerte. 6 mois : 5 800 contre 6 000, − 3,3 % : sous le seuil de 5 %
  expect(alertesMagasin(e, alertesParDefaut).map((a) => a.type)).toEqual(['tickets'])
  expect(alertesMagasin(e, alertesParDefaut, 6)).toEqual([])
})

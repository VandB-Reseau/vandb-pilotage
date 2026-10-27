import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apercuImport, FichierInattendu, lireTickets, lireVentes, moisDe, nombre } from '../../src/import/caisse'
import { syntheseReel, type LigneReel } from '../../src/moteur/reel'
import { famillesASaisir, lireSaisie, saisieDepuisReel } from '../../src/moteur/saisieReel'

// Fichiers fictifs au format de la DSI (tests/fichiers) : codes magasins et montants inventés.
const fichier = (nom: string) => readFileSync(new URL(`../fichiers/${nom}`, import.meta.url), 'utf8')

test('les nombres et les dates du fichier de la DSI sont lus dans tous les formats courants', () => {
  expect(nombre('1 250,40')).toBe(1250.4)
  expect(nombre('1.250,40')).toBe(1250.4)
  expect(nombre('1250.40')).toBe(1250.4)
  expect(nombre('')).toBeNull()
  expect(nombre('abc')).toBeNaN()
  expect(moisDe('2026-10-03')).toBe('2026-10')
  expect(moisDe('03/10/2026')).toBe('2026-10')
  expect(moisDe('2026-10')).toBe('2026-10')
  expect(moisDe('2026-13-01')).toBeNull()
})

test('les ventes du jour sont cumulées par magasin, mois, univers et famille ; les lignes fautives sont signalées', () => {
  const v = lireVentes(fichier('ventes_2026-09.csv'))
  expect(v.nbLignes).toBe(11)
  const biere = v.lignes.find((l) => l.code === '0101' && l.mois === '2026-09' && l.famille === 'Bière')
  // 1 000 + 500,50 ; 1 200 + 600,60 ; 360 + 180,18
  expect(biere).toEqual({ code: '0101', mois: '2026-09', univers: 'cave', famille: 'Bière', caHT: 1500.5, caTTC: 1800.6, margeHT: 540.18 })
  expect(v.lignes.find((l) => l.famille === 'Vin' && l.code === '0101')?.univers).toBe('cave')
  expect(v.lignes.find((l) => l.famille === 'Factures')?.univers).toBe('exterieur')
  expect(v.lignes.filter((l) => l.mois === '2026-10')).toHaveLength(1)
  expect(v.lignes).toHaveLength(7)
  expect(v.erreurs).toEqual([
    'Ligne 10 : date « 2026-13-01 » illisible (attendu AAAA-MM-JJ).',
    'Ligne 11 : univers « TERRASSE » inconnu (CAVE, BAR ou EXTERIEUR).',
    'Ligne 12 : CA HT « abc » illisible.',
  ])
  expect(v.alertes).toEqual(['Famille « KOMBUCHA » absente de la liste du réseau : gardée telle quelle.'])
})

test('les tickets sont cumulés par univers ; un fichier sans les bonnes colonnes est refusé', () => {
  const t = lireTickets(fichier('tickets_2026-09.csv'))
  expect(t.lignes).toEqual([
    { code: '0101', mois: '2026-09', univers: 'cave', tickets: 100 },
    { code: '0101', mois: '2026-09', univers: 'bar', tickets: 30 },
    { code: '0102', mois: '2026-09', univers: 'exterieur', tickets: 2 },
  ])
  expect(() => lireTickets(fichier('ventes_2026-09.csv'))).toThrow(FichierInattendu)
  let manquantes: string[] = []
  try { lireVentes('magasin;jour\n1;2') } catch (e) { manquantes = (e as FichierInattendu).manquantes }
  expect(manquantes).toEqual(['code_magasin', 'date', 'univers', 'famille', 'ca_ht', 'marge_ht'])
})

test('synthèse du réel : cumul, marge, poids des familles et panier moyen', () => {
  const lignes: LigneReel[] = [
    { mois: 1, univers: 'cave', famille: 'Bière', caHT: 10_000, caTTC: 12_000, margeHT: 3_600 },
    { mois: 1, univers: 'bar', famille: 'Fût', caHT: 10_000, caTTC: 12_000, margeHT: 7_400 },
    { mois: 2, univers: 'cave', famille: 'Bière', caHT: 20_000, caTTC: 24_000, margeHT: 7_200 },
  ]
  const s = syntheseReel(lignes, [{ mois: 1, univers: 'cave', tickets: 600 }, { mois: 1, univers: 'bar', tickets: 400 }])
  expect(s.caHT).toBe(40_000)
  expect(s.margeHT).toBe(18_200)
  expect(s.tauxMarge).toBeCloseTo(0.455, 6)
  expect(s.moisRenseignes).toBe(2)
  // Bière : 30 000 sur 40 000 de CA, marge 10 800 sur 30 000
  expect(s.familles[0]).toMatchObject({ famille: 'Bière', caHT: 30_000, part: 0.75 })
  expect(s.familles[0].tauxMarge).toBeCloseTo(0.36, 6)
  // Panier de janvier : 24 000 TTC pour 1 000 tickets ; février, sans tickets, n'entre pas dans le panier moyen
  expect(s.parMois[0].panierTTC).toBe(24)
  expect(s.parMois[1].panierTTC).toBeNull()
  expect(s.panierTTC).toBe(24)
})

test('aperçu de l’import : totaux par magasin et par mois, codes caisse inconnus', () => {
  const v = lireVentes(fichier('ventes_2026-09.csv'))
  const t = lireTickets(fichier('tickets_2026-09.csv'))
  const a = apercuImport(v.lignes, t.lignes, new Map([['0101', 'Brionne-sur-Lac']]))
  expect(a.mois).toEqual(['2026-09', '2026-10'])
  expect(a.codesInconnus).toEqual(['0102', '9999'])
  // Septembre : 1 500,50 + 2 000 + 800 de CA ; 540,18 + 600 + 600 de marge ; 100 + 30 tickets
  expect(a.lignes[0]).toMatchObject({ magasin: 'Brionne-sur-Lac', mois: '2026-09', caHT: 4300.5, margeHT: 1740.18, tickets: 130 })
  expect(a.lignes[0].tauxMarge).toBeCloseTo(1740.18 / 4300.5, 9)
  expect(a.lignes[1]).toMatchObject({ mois: '2026-10', caHT: 100, tickets: 0 })
})

test('saisie d’un mois : champs pré-remplis, montants à la française, CA HT obligatoire', () => {
  const lignes: LigneReel[] = [
    { mois: 3, univers: 'cave', famille: 'Bière', caHT: 1250.4, caTTC: null, margeHT: 450 },
    { mois: 3, univers: 'cave', famille: 'Kombucha', caHT: 80, caTTC: 96, margeHT: 30 },
  ]
  const s = saisieDepuisReel(lignes, [{ mois: 3, univers: 'cave', tickets: 52 }], 3)
  expect(s.ventes['cave/Bière']).toEqual({ caHT: '1250,4', caTTC: '', margeHT: '450' })
  expect(s.tickets).toEqual({ cave: '52' })
  // Une famille propre au magasin reste proposée à la saisie
  expect(famillesASaisir(s)[0].familles).toContain('Kombucha')
  expect(lireSaisie(s)).toEqual({
    lignes: [
      { univers: 'cave', famille: 'Bière', caHT: 1250.4, caTTC: null, margeHT: 450 },
      { univers: 'cave', famille: 'Kombucha', caHT: 80, caTTC: 96, margeHT: 30 },
    ],
    tickets: [{ univers: 'cave', tickets: 52 }],
    erreurs: [],
  })
  const fautive = lireSaisie({ ventes: { 'bar/Fût': { caHT: '', caTTC: '', margeHT: '300' }, 'cave/Vin': { caHT: 'douze', caTTC: '', margeHT: '' } }, tickets: { bar: '12,5' } })
  expect(fautive.erreurs).toEqual(['Vin (Cave) : un montant est illisible.', 'Fût (Bar) : le CA HT manque.', 'Tickets Bar : un nombre entier est attendu.'])
})

import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type QuadrimestreSimule, type VenteSimulee, allerVers } from './supabase-simule'

// Quadrimestres : quelques montants comptables saisis, marge réelle et EBE calculés. Données fictives : dépôt public.
// Mêmes chiffres que tests/moteur/quadrimestre.spec.ts, vérifiés à la main.

const N = new Date().getFullYear()
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: null, hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Janvier à avril : 50 000 € de CA HT par mois, 20 000 € de marge théorique de la caisse (40 %)
const reel: VenteSimulee[] = [1, 2, 3, 4].map((m) =>
  ({ store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 }))
const ligne = (page: import('@playwright/test').Page, nom: string) =>
  page.getByRole('table', { name: `Résultat réel ${N} par quadrimestre` }).getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé saisit son premier quadrimestre : marge réelle, démarque et EBE calculés', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin], reel })
  await ouvrir(page, 'Quadrimestres')
  await expect(ligne(page, 'CA HT de la caisse')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer les quadrimestres' })).toHaveCount(0)

  const champ = (libelle: string) => page.getByLabel(`${libelle} : janvier à avril`)
  await champ('Achats de marchandises HT').fill('130000')
  await champ('Variation de stock (fin − début)').fill('8000')
  // Marge réelle : 200 000 − (130 000 − 8 000) = 78 000, soit 39 % face à 40 % pour la caisse
  await expect(ligne(page, 'Marge réelle')).toContainText(/78\s000/)
  await expect(ligne(page, 'Taux de marge réel')).toContainText('39')
  await expect(ligne(page, 'Écart à la marge de la caisse (démarque)')).toContainText(/[-−]1[,.]0\spt/)
  await expect(ligne(page, 'EBE réel')).not.toContainText(/\d/)
  // Achats en négatif : refusés
  await champ('Charges externes (redevance et publicité comprises)').fill('-30000')
  await expect(page.getByText('Les achats et les charges se saisissent en positif.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer les quadrimestres' })).toBeDisabled()
  await champ('Charges externes (redevance et publicité comprises)').fill('30000')
  await champ('Impôts et taxes').fill('3000')
  await champ('Frais de personnel').fill('35000')
  await champ('Trésorerie en fin de période').fill('25000')
  // EBE : 78 000 − 30 000 − 3 000 − 35 000 = 10 000, 5 % du CA
  await expect(ligne(page, 'EBE réel')).toContainText(/10\s000/)
  await expect(ligne(page, 'EBE / CA')).toContainText('5')
  // Lot 37 : la saisie seule dans l'espace Données ; le résultat se lit dans le Suivi
  await expect(page.getByRole('region', { name: /Résultat réel à fin/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-quadrimestres.png`, fullPage: true })

  await page.getByRole('button', { name: 'Enregistrer les quadrimestres' }).click()
  await expect(page.getByText('Quadrimestres enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'quadrimestres' && e.methode === 'POST')?.corps as QuadrimestreSimule[]
  expect(envoi).toEqual([{
    store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000,
    charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000,
  }])
})

test('Suivi : le compte du quadrimestre et ses indicateurs, sans saisie', async ({ page, isMobile }) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres })
  await ouvrir(page, 'Comptes du quadrimestre')
  const cartes = page.getByRole('region', { name: 'Résultat réel à fin avril' })
  await expect(cartes).toContainText(/10\sk€/)
  await expect(cartes).toContainText('17,5')                   // % FP : 35 000 / 200 000
  await expect(page.getByLabel('Achats de marchandises HT : janvier à avril')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('quadrimestre enregistré repris ; sans caisse, la marge reste à calculer', async ({ page }) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
    { store_name: MAGASINS[0], annee: N, quadrimestre: 2, achats: 100_000, variation_stock: null, charges_externes: null, impots_taxes: null, personnel: null, tresorerie: null },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres })
  await ouvrir(page, 'Quadrimestres')
  await expect(page.getByLabel('Achats de marchandises HT : janvier à avril')).toHaveValue(/130\s000/)
  // Mai à août : pas de caisse, pas de marge ; le cumul s'arrête aux charges complètes
  const marge = ligne(page, 'Marge réelle').getByRole('cell')
  await expect(marge.nth(1)).toContainText(/78\s000/)
  await expect(marge.nth(2)).toHaveText('–')
  await expect(ligne(page, 'EBE réel').getByRole('cell').nth(4)).toHaveText('–')
  await expect(page.getByRole('region', { name: /Résultat réel à fin/ })).toHaveCount(0)
})

test('le Directeur importe le fichier des comptables : code caisse ou nom du magasin', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { codes: [{ code: '0101', store_name: MAGASINS[1] }] })
  await allerVers(page, 'Imports de caisse')
  const section = page.getByRole('region', { name: 'Quadrimestres des comptables' })
  await page.getByLabel('Fichier des quadrimestres').setInputFiles(new URL('./fichiers/quadrimestres_2026-1.csv', import.meta.url).pathname)
  await expect(section).toContainText('quadrimestres_2026-1.csv : 2 quadrimestres, 2 magasins')
  await expect(section).toContainText('Ligne 5 : quadrimestre « 4 » inconnu (1, 2 ou 3).')
  await expect(section).toContainText('Magasin introuvable pour : 0999.')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText('2 quadrimestres importés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'quadrimestres' && e.methode === 'POST')?.corps as QuadrimestreSimule[]
  expect(envoi).toEqual([
    { store_name: MAGASINS[1], annee: 2026, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
    { store_name: MAGASINS[0], annee: 2026, quadrimestre: 2, achats: 100_000, variation_stock: null, charges_externes: null, impots_taxes: null, personnel: null, tresorerie: null },
  ])
})

test('plan de trésorerie : solde réel fin avril face au prévu, puis projection jusqu’à décembre', async ({ page, isMobile }, info) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres })
  await ouvrir(page, 'Trésorerie')
  const section = page.getByRole('region', { name: `Plan de trésorerie ${N}` })
  await expect(section).toContainText(/Trésorerie fin avril25\sk€/)
  await expect(section.getByRole('img', { name: new RegExp(`^Trésorerie de fin de mois ${N} : point bas`) })).toBeVisible()
  const tableau = section.getByRole('table', { name: `Plan de trésorerie ${N} mois par mois` })
  await expect(tableau.getByRole('columnheader')).toHaveCount(13)
  // Fin avril : le solde réel, face au prévu ; projection ensuite : chaque fin de mois = la précédente + le flux prévu
  const lire = (t: string) => Number(t.replace(/[\s  +]/g, '').replace('−', '-').replace('€', '').replace(',', '.')) * 1000 // k€
  const fin = tableau.getByRole('row', { name: /^Trésorerie en fin de mois/ })
  // T1 (2/11/2026) : un chiffre par case en k€ ; fin avril, le solde réel
  await expect(fin.getByRole('cell').nth(4)).toHaveText(/^25\s*réel$/)
  await expect(fin.getByRole('cell').nth(4)).toHaveAttribute('title', /^Réel 25\s000 €, prévu/)
  const projetees = (await tableau.getByRole('row', { name: /^Trésorerie projetée/ }).getByRole('cell').allTextContents()).slice(1)
  expect(lire(projetees[3])).toBe(25_000)
  expect(projetees.slice(0, 3).every((t) => t === '')).toBe(true)
  // Par quadrimestre : décaissé réel déduit dès que le début, l'encaissé des 4 mois et la fin sont connus
  await expect(section.getByRole('table', { name: `Trésorerie ${N} par quadrimestre` })).toHaveCount(0)
  await section.getByRole('button', { name: 'Quadrimestre' }).click()
  await expect(section.getByRole('table', { name: `Trésorerie ${N} par quadrimestre` })).toBeVisible()
  await expect(section.getByRole('img', { name: /par quadrimestre : fin de période/ })).toBeVisible()
  await section.getByRole('button', { name: 'Mois' }).click()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.screenshot({ path: `captures/${info.project.name}-plan-tresorerie.png` })
})

test('cumul face au budget et à la même période de l’an passé, ligne par ligne', async ({ page, isMobile }, info) => {
  // An passé : 40 000 € de CA par mois de janvier à avril ; quadrimestre comptable saisi
  const reelN1: VenteSimulee[] = [1, 2, 3, 4].map((m) =>
    ({ store_name: MAGASINS[0], mois: `${N - 1}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 40_000, ca_ttc: 48_000, marge_ht: 16_000 }))
  const q = (annee: number, achats: number, variation: number, externes: number, impots: number, personnel: number): QuadrimestreSimule =>
    ({ store_name: MAGASINS[0], annee, quadrimestre: 1, achats, variation_stock: variation, charges_externes: externes, impots_taxes: impots, personnel, tresorerie: null })
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel: [...reel, ...reelN1],
    quadrimestres: [q(N, 130_000, 8_000, 30_000, 3_000, 35_000), q(N - 1, 100_000, 4_000, 28_000, 3_000, 31_000)] })
  await ouvrir(page, 'Comptes du quadrimestre')
  const tableau = page.getByRole('table', { name: `Cumul ${N} face au budget et à ${N - 1}` })
  // Lot 38 : le cumul est replié sous le pont d'EBE
  await page.getByRole('button', { name: /^Cumul à fin avril/ }).click()
  await expect(tableau.getByRole('columnheader', { name: 'Écart au budget' })).toBeVisible()
  // CA 200 000 contre 160 000 : + 25 % ; marge 78 000 contre 64 000 (100 000 − 4 000 retirés de 160 000) ; EBE 10 000 contre 2 000
  const ligneN1 = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  await expect(ligneN1('CA HT')).toContainText(/160\s000\s€/)
  await expect(ligneN1('CA HT')).toContainText(/\+25,0\s%/)
  await expect(ligneN1('Marge réelle')).toContainText(/64\s000\s€/)
  await expect(ligneN1('Frais de personnel')).toContainText(/31\s000\s€/)
  await expect(ligneN1('EBE')).toContainText(/2\s000\s€/)
  await expect(ligneN1('EBE')).toContainText(/\+400,0\s%/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-quadrimestres-comparaison.png`, fullPage: true })
})

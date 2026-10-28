import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type QuadrimestreSimule, type VenteSimulee } from './supabase-simule'

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
  await page.getByRole('tab', { name: 'Quadrimestres' }).click()
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
  const cartes = page.getByRole('region', { name: 'Résultat réel à fin avril' })
  await expect(cartes).toContainText(/10\sk€/)
  await expect(cartes).toContainText('44,9')                   // masse salariale / marge : 35 000 / 78 000
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

test('quadrimestre enregistré repris ; sans caisse, la marge reste à calculer', async ({ page }) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
    { store_name: MAGASINS[0], annee: N, quadrimestre: 2, achats: 100_000, variation_stock: null, charges_externes: null, impots_taxes: null, personnel: null, tresorerie: null },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres })
  await page.getByRole('tab', { name: 'Quadrimestres' }).click()
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
  await page.getByRole('link', { name: /Imports/ }).click()
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

test('trésorerie glissante : fin avril saisie, puis mai à décembre selon l’atterrissage', async ({ page, isMobile }, info) => {
  const quadrimestres: QuadrimestreSimule[] = [
    { store_name: MAGASINS[0], annee: N, quadrimestre: 1, achats: 130_000, variation_stock: 8_000, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 25_000 },
  ]
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres })
  await page.getByRole('tab', { name: 'Quadrimestres' }).click()
  const section = page.getByRole('region', { name: 'Trésorerie prévue jusqu’à décembre' })
  await expect(section).toContainText(/Trésorerie fin avril25\sk€/)
  const tableau = section.getByRole('table', { name: `Trésorerie prévue ${N} mois par mois` })
  await expect(tableau.getByRole('columnheader')).toHaveText(['En euros', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'])
  // Chaque fin de mois = la précédente + la variation du mois
  const lire = (t: string) => Number(t.replace(/[\s  +]/g, '').replace('−', '-').replace('€', ''))
  const flux = (await tableau.getByRole('row').nth(1).getByRole('cell').allTextContents()).slice(1).map(lire)
  const fins = (await tableau.getByRole('row').nth(2).getByRole('cell').allTextContents()).slice(1).map(lire)
  expect(Math.abs(fins[0] - (25_000 + flux[0]))).toBeLessThanOrEqual(1)
  expect(Math.abs(fins[7] - (fins[6] + flux[7]))).toBeLessThanOrEqual(1)
  // La trésorerie saisie change : la prévision suit sans enregistrer
  await page.getByLabel('Trésorerie en fin de période : janvier à avril').fill('35000')
  await expect(section).toContainText(/Trésorerie fin avril35\sk€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.screenshot({ path: `captures/${info.project.name}-tresorerie-glissante.png` })
})

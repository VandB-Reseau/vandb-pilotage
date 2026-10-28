import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { fecFictif } from './fec-fictif'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type QuadrimestreSimule, type VenteSimulee } from './supabase-simule'

// Import du FEC dans les quadrimestres : FEC fictif de tests/fec-fictif.ts, montants vérifiés à la main. Dépôt public.

const N = new Date().getFullYear()
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: null, hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Caisse : 50 000 € de CA HT par mois de janvier à avril, soit les 200 000 € du FEC
const reel: VenteSimulee[] = [1, 2, 3, 4].map((m) =>
  ({ store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 }))
const fichier = (annee: number, nom = 'FEC_fictif.txt') => ({ name: nom, mimeType: 'text/plain', buffer: Buffer.from(fecFictif(annee), 'utf-8') })
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

test('le franchisé importe le FEC, range le compte inconnu et retrouve marge et EBE', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin], reel })
  await page.getByRole('tab', { name: 'Quadrimestres' }).click()
  await page.locator('input[type=file]').setInputFiles(fichier(N))
  const fec = page.getByRole('region', { name: 'FEC du comptable' })
  await expect(fec).toContainText('FEC du comptable : FEC_fictif.txt')
  await expect(fec.getByText('Un compte à ranger avant de reprendre les montants.')).toBeVisible()
  await expect(fec.getByRole('button', { name: 'Reprendre : janvier à avril' })).toBeDisabled()
  // CA du FEC égal à celui de la caisse : pas d'alerte ; stock passé : pas d'alerte non plus
  await expect(fec.getByText(/CA du FEC/)).toHaveCount(0)
  await expect(fec.getByText(/Pas de stock/)).toHaveCount(0)

  await fec.getByRole('combobox', { name: 'Rubrique du compte 658000' }).click()
  await page.getByRole('option', { name: 'Charges externes' }).click()
  const montants = fec.getByRole('table', { name: `Montants du FEC : janvier à avril ${N}` })
  await expect(montants.getByRole('row', { name: /Charges externes/ })).toContainText(/18\s300/)
  await expect(montants.getByRole('row', { name: /Achats de marchandises/ })).toContainText(/98\s000/)
  await expect(montants.getByRole('row', { name: /Trésorerie/ })).toContainText(/50\s000/)
  await fec.getByRole('button', { name: 'Voir les comptes (12)' }).click()
  await expect(fec.getByRole('table', { name: 'Comptes de charges du FEC' }).getByRole('row')).toHaveCount(13)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-import-fec.png`, fullPage: true })

  await fec.getByRole('button', { name: 'Reprendre : janvier à avril' }).click()
  await expect(page.getByText('Montants du FEC repris : janvier à avril.')).toBeVisible()
  await expect(page.getByLabel('Achats de marchandises HT : janvier à avril')).toHaveValue(/98\s000/)
  await expect(page.getByLabel('Variation de stock (fin − début) : janvier à avril')).toHaveValue(/5\s000/)
  // Marge réelle : 200 000 − (98 000 − 5 000) = 107 000 ; EBE : 107 000 − 18 300 − 1 500 − 39 000 = 48 200
  await expect(ligne(page, 'Marge réelle')).toContainText(/107\s000/)
  await expect(ligne(page, 'EBE réel')).toContainText(/48\s200/)
  expect(ecritures.filter((e) => e.table === 'correspondances_fec' && e.methode === 'POST').map((e) => e.corps))
    .toEqual([[{ store_name: MAGASINS[0], compte: '658000', rubrique: 'charges_externes' }]])

  await page.getByRole('button', { name: 'Enregistrer les quadrimestres' }).click()
  await expect(page.getByText('Quadrimestres enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'quadrimestres' && e.methode === 'POST')?.corps as QuadrimestreSimule[]
  expect(envoi[0]).toMatchObject({ quadrimestre: 1, achats: 98_000, variation_stock: 5_000, charges_externes: 18_300, impots_taxes: 1_500, personnel: 39_000, tresorerie: 50_000 })
})

test('classement gardé au deuxième import ; fichier hors période ou illisible expliqué', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [magasin], reel, correspondances: [{ store_name: MAGASINS[0], compte: '658000', rubrique: 'hors_ebe' }] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: 'Quadrimestres' }).click()
  const fec = page.getByRole('region', { name: 'FEC du comptable' })
  await page.locator('input[type=file]').setInputFiles(fichier(N))
  await expect(fec.getByRole('table', { name: `Montants du FEC : janvier à avril ${N}` }).getByRole('row', { name: /Charges externes/ })).toContainText(/18\s000/)
  await expect(fec.getByText(/à ranger/)).toHaveCount(0)
  await expect(fec.getByRole('button', { name: 'Reprendre : janvier à avril' })).toBeEnabled()
  await fec.getByRole('button', { name: 'Annuler' }).click()
  await expect(fec).toHaveCount(0)

  await page.locator('input[type=file]').setInputFiles(fichier(N - 1, 'FEC_ancien.txt'))
  await expect(fec.getByText(/il ne couvre aucun quadrimestre/)).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'autre.csv', mimeType: 'text/csv', buffer: Buffer.from('Compte;Date\r\n607;2026\r\n') })
  await expect(fec.getByText(/n’a pas les colonnes d’un FEC/)).toBeVisible()
})

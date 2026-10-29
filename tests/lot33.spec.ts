import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { fecFictif } from './fec-fictif'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule } from './supabase-simule'

// Lot 33 : frais en encarts par thème et repris du FEC, résultat mois par mois, BFR, validation par le RR.
// Données fictives uniquement : dépôt public.
const magasins = (statut: MagasinSimule['statut'] = 'propose'): MagasinSimule[] => [
  { magasin: MAGASINS[0], statut, hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null },
]
const loyer: FraisSimule = { store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('frais : un encart par thème, lignes reprises du FEC ramenées à l’année', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: magasins(), frais: [loyer] })
  await ouvrir(page, 'Frais')
  await expect(page.getByRole('region', { name: 'Immobilier' })).toContainText(/60\s000\s€/)
  await expect(page.getByRole('region', { name: 'Redevances du réseau' })).toContainText(/3,0\s%\sdu CA/)
  // FEC fictif de janvier à mai : 5 mois, chaque compte × 12 ÷ 5
  await page.getByLabel('FEC pour les frais').setInputFiles({ name: 'FEC.txt', mimeType: 'text/plain', buffer: Buffer.from(fecFictif(2026)) })
  const reprise = page.getByRole('region', { name: 'Frais repris du FEC' })
  await expect(reprise).toContainText('Fichier de 5 mois')
  await expect(reprise).toContainText(/Locations immobilières.*28\s800\s€/)
  await reprise.getByRole('checkbox', { name: /^Charges diverses/ }).uncheck()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-frais-fec.png`, fullPage: true })
  await reprise.getByRole('button', { name: /^Reprendre les lignes cochées/ }).click()
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveValue('28 800')
  await expect(page.getByLabel('Publicité diverse et animation', { exact: true })).toHaveValue('4 800')
  await expect(page.getByLabel('Cotisation foncière des entreprises', { exact: true })).toHaveValue('3 600')
  await expect(page.getByLabel('Intérêts sur emprunts')).toHaveValue('960')
  await expect(page.getByLabel('Charges diverses', { exact: true })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-frais-encarts.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Frais enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'frais' && e.methode === 'POST')?.corps as FraisSimule[]
  expect(envoi.find((l) => l.code === 'loyer')?.annuel).toBe(28_800)
})

test('résultat : impôt, résultat net et capital remboursé mois par mois ; besoin en fonds de roulement', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: magasins() })
  await ouvrir(page, 'Résultat et trésorerie')
  const compte = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  const cellules = (nom: RegExp) => compte.getByRole('row', { name: nom }).getByRole('cell')
  await expect(cellules(/^Résultat net/).nth(1)).not.toHaveText('')
  await expect(cellules(/^Impôt sur les sociétés/).nth(1)).not.toHaveText('')
  await expect(cellules(/^Capital des emprunts remboursé/).nth(1)).toHaveText(/-2\s500/)   // 30 000 ÷ 12
  await expect(cellules(/^Amortissements réintégrés/).nth(1)).toHaveText(/2\s000/)        // 24 000 ÷ 12
  await expect(page.getByRole('button', { name: 'Aide : Besoin en fonds de roulement' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-resultat-mensuel.png`, fullPage: true })
})

test('le RR valide le budget de son magasin, puis le rouvre', async ({ page }) => {
  const ecritures = await seConnecter(page, { role: 'rr', magasins: magasins('en_discussion') })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByRole('button', { name: 'Copier vers d’autres magasins' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Valider le budget' }).click()
  await expect(page.getByText('Budget 2027 validé.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { statut: string; ajustements?: unknown }
  expect(envoi.statut).toBe('valide')
  expect(envoi.ajustements).toBeUndefined()
  await page.getByRole('button', { name: 'Rouvrir la discussion' }).click()
  await expect(page.getByText('Budget rouvert : il est de nouveau en discussion.')).toBeVisible()
})

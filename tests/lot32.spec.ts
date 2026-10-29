import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 32 : modèles d'import à télécharger, picto (i) sur les chiffres calculés. Données fictives : dépôt public.
const magasins = (): MagasinSimule[] => [
  { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('imports : chaque import propose son modèle', async ({ page, isMobile }) => {
  await seConnecter(page)
  await page.getByRole('link', { name: /Imports/ }).first().click()
  const telechargement = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Modèle des ventes' }).click()
  const fichier = await telechargement
  expect(fichier.suggestedFilename()).toBe('modele_ventes_AAAA-MM.csv')
  await expect(page.getByRole('button', { name: 'Modèle des tickets' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quadrimestres des comptables' }).getByRole('button', { name: 'Télécharger le modèle' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('fiche : picto (i) sur les chiffres clés et les lignes calculées du compte de résultat et de la trésorerie', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: magasins() })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByRole('button', { name: 'Comment c’est calculé : EBE' })).toBeVisible()
  await expect(page.getByText('D’où vient ce chiffre ?')).toHaveCount(0)
  await page.getByRole('button', { name: 'Aide : Masse salariale / CA' }).click()
  await expect(page.getByRole('dialog', { name: 'Masse salariale / CA' })).toContainText('Frais de personnel (gérant compris) ÷ CA HT')
  await page.keyboard.press('Escape')
  await ouvrir(page, 'Résultat et trésorerie')
  const compte = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  await compte.getByRole('button', { name: 'Aide : Excédent brut d’exploitation (EBE)' }).click()
  await expect(page.getByRole('dialog', { name: 'Excédent brut d’exploitation (EBE)' })).toContainText('Marge commerciale − charges externes')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Aide : Point mort' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-pictos-calcul.png`, fullPage: true })
})

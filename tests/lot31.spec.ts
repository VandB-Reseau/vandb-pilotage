import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 31 : hypothèses réglées par univers, détail par famille à la demande. Données fictives : dépôt public.
// Sans cible, Cave : Bière 200 000 € à 36 % de marge.
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

test('hypothèses par univers : marge et démarque de la Cave en un champ, familles repliées', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: magasins() })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const cave = page.getByRole('region', { name: 'Hypothèses du magasin' }).getByRole('region', { name: 'Cave' })
  await expect(cave.getByRole('group', { name: 'Tickets (Cave)' })).toBeVisible()
  await expect(cave.getByRole('table')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses-univers.png`, fullPage: true })

  // Marge visée 38 % et démarque 2 % : 200 000 × (38 % − 2 %) = 72 000
  await page.getByLabel('Marge visée : Cave').fill('38')
  await page.getByLabel('Démarque : Cave').fill('2')
  await expect(cave).toContainText(/Marge 2027 : 72\sk€/)
  await expect(cave.getByRole('group', { name: 'Démarque' })).toContainText(/4\sk€ perdus/)
  // Le détail montre la famille réglée
  await cave.getByRole('button', { name: /^Détail par famille \(1\)/ }).click()
  await expect(page.getByLabel('Marge visée par famille : Bière (Cave)')).toHaveValue('38')
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText(/Ajustements enregistrés/)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: unknown }
  expect(envoi.ajustements).toEqual({ margeFamille: { 'cave/Bière': 0.38 }, demarqueFamille: { 'cave/Bière': 0.02 } })
  // Reprendre la proposition pour tout l'univers
  await page.getByRole('button', { name: 'Reprendre la valeur du niveau au-dessus : démarque Cave' }).click()
  await expect(cave).toContainText(/Marge 2027 : 76\sk€/)
})

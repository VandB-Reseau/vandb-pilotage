import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites } from './supabase-simule'

// Panneau Impact (Joseph, 03/11/2026, propositions 1, 2 et 3) : l'effet de chaque changement d'hypothèse sur le CA, la
// marge, la masse salariale, l'EBE, le résultat net et la trésorerie ; tableau plus étroit avec l'effet en EBE ; boutons
// − et + et flèches du clavier. Données fictives uniquement : dépôt public.

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le panneau Impact suit chaque changement, isole le dernier et enregistre', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements_siege: {} }] })
  await ouvrir(page, 'Construire')
  const impact = page.getByRole('complementary', { name: 'Impact des changements' })
  await expect(impact).toBeVisible()
  // L'ancienne bande d'indicateurs ne double plus le panneau
  await expect(page.getByRole('region', { name: 'Indicateurs clés' })).toHaveCount(0)
  if (isMobile) await impact.getByRole('button', { name: 'Voir l’impact' }).click()
  for (const l of ['CA', 'Marge', 'Masse salariale', 'EBE', 'Résultat net']) await expect(impact).toContainText(l)
  await expect(impact.locator('[data-impact="ebe"]')).toContainText('inchangé')

  // Proposition 3 : + d'un point de tickets Cave, puis la flèche du haut pour un deuxième point
  const tickets = page.getByLabel('Évolution du nombre de tickets : Cave', { exact: true })
  await page.getByRole('button', { name: 'Monter : Évolution du nombre de tickets : Cave' }).click()
  await expect(tickets).toHaveValue('1')
  await tickets.focus()
  await tickets.press('ArrowUp')
  await expect(tickets).toHaveValue('2')
  // Entrée : l'hypothèse suivante
  await tickets.press('Enter')
  await expect(page.getByLabel('Évolution du panier moyen : Cave', { exact: true })).toBeFocused()

  // Proposition 1 : le CA et l'EBE montent, en vert ; le dernier changement se lit et s'annule
  await expect(impact.locator('[data-impact="ca"]')).toContainText('+')
  await expect(impact.locator('[data-impact="ebe"]')).not.toContainText('inchangé')
  const dernier = impact.getByRole('group', { name: 'Dernier changement' })
  await expect(dernier).toContainText('Tickets Cave')
  await expect(dernier).toContainText('de CA')
  await expect(dernier).toContainText('d’EBE')
  await expect(impact).toContainText('1 changement non enregistré')

  // Proposition 2 : l'effet en CA et en EBE ; « Point de départ » remplace l'année en cours et la proposition du siège
  const cave = page.getByRole('table', { name: /Hypothèses \d+ : Cave/ })
  if (!isMobile) {
    await expect(cave.getByRole('columnheader', { name: 'Point de départ' })).toBeVisible()
    await expect(cave.getByRole('row', { name: /^Tickets/ })).toContainText(/k€ CA.*k€ EBE/)
  }
  await expect(cave.getByRole('columnheader', { name: 'Siège propose' })).toHaveCount(0)
  // La démarque, nulle, ne s'affiche qu'avec le détail
  await expect(page.getByLabel('Démarque : Cave', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /^Démarque et détail par famille/ }).first().click()
  await expect(page.getByLabel('Démarque : Cave', { exact: true })).toBeVisible()

  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-impact.png`, fullPage: !isMobile })

  // Face au siège : même écart ici, le siège n'ayant rien proposé d'autre que la base
  await impact.getByRole('button', { name: 'Proposition du siège' }).click()
  await expect(impact.getByRole('button', { name: 'Proposition du siège' })).toHaveAttribute('aria-pressed', 'true')

  await dernier.getByRole('button', { name: /^Annuler le dernier changement/ }).click()
  await expect(tickets).toHaveValue('')
  await expect(impact.getByRole('group', { name: 'Dernier changement' })).toHaveCount(0)

  // Enregistrer depuis le panneau
  await page.getByRole('button', { name: 'Monter : Évolution du nombre de tickets : Cave' }).click()
  await impact.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés.', { exact: false })).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements).toEqual({ evolutionFlux: { cave: 0.01 } })
})

test('le panneau reste sur les thèmes du budget ; en lecture, il compare au siège sans rien enregistrer', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'coach', magasins: [{ magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements: { evolutionFlux: { cave: 0.05 } }, ajustements_siege: {} }] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Construire')
  const impact = page.getByRole('complementary', { name: 'Impact des changements' })
  if (isMobile) await impact.getByRole('button', { name: 'Voir l’impact' }).click()
  await expect(impact.getByRole('button', { name: 'Proposition du siège' })).toHaveAttribute('aria-pressed', 'true')
  // + 5 % de tickets Cave face au siège : le CA et l'EBE sont au-dessus
  await expect(impact.locator('[data-impact="ca"]')).toContainText('+')
  await expect(impact.getByRole('button', { name: 'Enregistrer les ajustements' })).toHaveCount(0)
  // Thème Frais : le panneau suit
  await page.goto(page.url().replace(/\/budget$/, '/fraisBudget'))
  await expect(page.getByRole('complementary', { name: 'Impact des changements' })).toBeVisible()
  // Étape 2 : la bande d'indicateurs, pas le panneau
  await page.goto(page.url().replace(/\/fraisBudget$/, '/echanges'))
  await expect(page.getByRole('region', { name: 'Indicateurs clés' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Impact des changements' })).toHaveCount(0)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

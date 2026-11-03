import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, partieAffichee, partiesAffichees, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 37 (Joseph, 02/11/2026) : budget en 4 étapes ; toutes les hypothèses sur une page en cartes par thème (H2), chaque
// carte ouvre un tableau court (année en cours, siège, choix du magasin, année du budget) ; la trésorerie de l'année et
// le compte du quadrimestre se lisent dans le Suivi, la saisie reste dans Données. Données fictives.
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('hypothèses en cartes : chaque carte ouvre son tableau, les changements restent d’un thème à l’autre', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose] })
  await ouvrir(page, 'Cartes des hypothèses')
  await expect(page).toHaveURL(/\/budget$/)
  await expect(partiesAffichees(page))
    .toHaveText([/^1 · Construire/, /^2 · Visualiser/, /^3 · Envoyer et valider/])
  const main = page.locator('main')
  // Joseph (03/11/2026) : toutes les hypothèses en cartes, ventes de chaque univers comprises ; le résultat a son étape
  await expect(main.getByRole('region', { name: 'Hypothèses du magasin' })).toBeHidden()
  await expect(main.getByRole('region', { name: 'Ventes Cave' })).toBeVisible()
  await expect(main.getByRole('table', { name: /mois par mois$/ })).toBeHidden()
  // Lot 43 : plus de carte Trésorerie, la trésorerie au 1er janvier est au point de départ
  await expect(main.getByRole('region', { name: 'Trésorerie', exact: true })).toHaveCount(0)
  for (const t of ['Point de départ', 'Évènements & Temps forts', 'Investissements & Financements', 'Équipe', 'Frais']) {
    await expect(main.getByRole('region', { name: t, exact: true })).toBeVisible()
  }
  // Sans équipe : la carte le dit
  await expect(main.getByRole('region', { name: 'Équipe', exact: true })).toContainText('À renseigner')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses-cartes.png`, fullPage: true })

  // Ventes : un tableau court par univers, de l'année en cours à l'année du budget, ouvert depuis la carte de l'univers
  await main.getByRole('region', { name: 'Ventes Cave' }).getByRole('link').click()
  await expect(page).toHaveURL(/\/ventes$/)
  await partieAffichee(page, /^1 · Construire/)
  const cave = page.getByRole('table', { name: /^Hypothèses \d{4} : Cave/ })
  await expect(cave.getByRole('columnheader')).toHaveText(isMobile ? [/^Hypothèse/, /^Choix du magasin/, /^\d{4}$/] : [/^Hypothèse/, /^Point de départ/, /^Choix du magasin/, /^\d{4}$/, /^Effet$/])
  await expect(cave.getByRole('row', { name: /^Tickets/ })).toContainText(/10\s000/)
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  const barre = page.getByRole('complementary', { name: 'Impact des changements' })
  await expect(barre).toContainText('1 changement')
  // Refonte A (2/11/2026) : marge 2026 pondérée par le CA (36 %), effet en euros : 200 k€ × 5 % = +10 k€ de CA ;
  // sans proposition du siège, « Rythme actuel » ; la flèche reprend la valeur du niveau au-dessus
  await expect(cave.getByRole('row', { name: /^Marge visée/ })).toContainText('36,0 %')
  if (!isMobile) {
    await expect(cave.getByRole('row', { name: /^Tickets/ })).toContainText(/\+10\sk€ CA/)
    await expect(cave.getByRole('row', { name: /^Tickets/ })).toContainText('Rythme actuel')
  }
  await expect(cave.getByRole('button', { name: 'Reprendre la valeur du niveau au-dessus : évolution des tickets Cave' })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses-ventes.png`, fullPage: true })

  // Lot 42 : le résultat a suivi (tickets Cave + 5 %) ; puis Frais : pas de question, le changement reste
  await expect(page.getByRole('dialog', { name: 'Modifications non enregistrées' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  await main.getByRole('region', { name: 'Frais', exact: true }).getByRole('link').click()
  await expect(page).toHaveURL(/\/fraisBudget$/)
  // Joseph (03/11/2026) : avec les cartes, l'inflation des frais se règle dans le thème Frais
  await expect(page.locator('main').getByLabel('Inflation des frais', { exact: true })).toBeVisible()
  await expect(barre).toContainText('1 changement')
  await expect(page.getByRole('region', { name: 'Indicateurs clés' })).toHaveCount(0)
})

test('Suivi : une page Trésorerie ; Données : la saisie du quadrimestre seule', async ({ page }) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Quadrimestres')
  await expect(page.getByRole('table', { name: /^Résultat réel \d{4} par quadrimestre/ })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Plan de trésorerie/ })).toHaveCount(0)
  await expect(page.getByRole('region', { name: /^Du budget au réel/ })).toHaveCount(0)
  await ouvrir(page, 'Trésorerie')
  await expect(page).toHaveURL(/\/tresorerie$/)
  await expect(page.getByRole('group', { name: 'Année de la trésorerie' })).toBeVisible()
  await ouvrir(page, 'Comptes du quadrimestre')
  await expect(page.getByRole('heading', { level: 2, name: 'Comptes du quadrimestre' })).toBeVisible()
})

test('fiche : « Changer de magasin » ouvre la liste des magasins avec recherche ; ni le menu ni la barre du haut ne le montrent', async ({ page, isMobile }) => {
  const autre: MagasinSimule = { ...propose, magasin: MAGASINS[1] }
  await seConnecter(page, { magasins: [propose, autre] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  await expect(page).toHaveURL(/\/visualiser$/)
  // Lot 42 : le magasin n'est plus dans le menu de gauche ; Joseph (03/11/2026) : ni dans la barre du haut, on en change depuis la fiche
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu.getByText(MAGASINS[0], { exact: true })).toHaveCount(0)
  // Joseph (03/11/2026) : les pages du magasin sont des onglets de sa fiche, plus dans le menu
  await expect(menu.getByText('Pages du magasin')).toHaveCount(0)
  await expect(page.getByRole('banner').getByRole('button', { name: /Changer de magasin/ })).toHaveCount(0)
  const selecteur = page.locator('main').getByRole('button', { name: `Changer de magasin (magasin ouvert : ${MAGASINS[0]})` })
  await selecteur.click()
  const dialogue = page.getByRole('dialog', { name: 'Changer de magasin' })
  await dialogue.getByLabel('Nom du magasin').fill(MAGASINS[1].slice(0, 4))
  await expect(dialogue.getByRole('button', { name: MAGASINS[0], exact: true })).toHaveCount(0)
  await dialogue.getByRole('button', { name: MAGASINS[1] }).click()
  // Même étape, autre magasin
  await expect(page).toHaveURL(new RegExp(`/magasins/${encodeURIComponent(MAGASINS[1])}/visualiser$`))
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

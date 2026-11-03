import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { allerVers, seConnecter, textesTropPetits, zonesTropPetites } from './supabase-simule'

// Préparation de la fusion avec l'app réseau (0028) : CA de la caisse face aux chiffres saisis dans l'app réseau,
// rattachement d'un magasin renommé. Données fictives uniquement.

const N = new Date().getFullYear()
const ligne = (magasin: string, mois: number, caCaisse: number | null, caReseau: number | null) => ({
  store_name: magasin, mois: `${N}-${String(mois).padStart(2, '0')}-01`, ca_caisse: caCaisse, tickets_caisse: null, ca_reseau: caReseau, tickets_reseau: null,
})
const concordance = [
  ligne(MAGASINS[0], 1, 10_000, 10_000), ligne(MAGASINS[0], 2, 10_300, 10_000),  // +3 % en février
  ligne(MAGASINS[1], 1, null, 8_000), ligne(MAGASINS[1], 2, 9_000, 9_000),       // janvier absent de la caisse
  ligne(MAGASINS[2], 1, 5_000, 5_000),
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur compare le CA de la caisse à celui de l’app réseau et rattache un magasin renommé', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { concordance, orphelins: [{ store_name: `${MAGASINS[2]} ancien`, lignes: 4, nouveau_nom: MAGASINS[2] }] })
  await allerVers(page, 'Imports de caisse')
  const carte = page.getByRole('region', { name: 'Avant la fusion avec l’app réseau' })
  await expect(carte.getByRole('heading', { name: /Avant la fusion/ })).toBeVisible()

  const bilan = carte.getByLabel('Bilan de la comparaison')
  await expect(bilan).toContainText('1 magasin avec des mois absents de la caisse')
  await expect(bilan).toContainText('1 avec un écart de plus de 2 %')
  await expect(bilan).toContainText('1 concordant')
  const tableau = carte.getByRole('table', { name: `CA de la caisse et de l’app réseau en ${N}` })
  const lignes = tableau.getByRole('row')
  // Le mois qui serait perdu passe en premier, puis l'écart
  await expect(lignes.nth(1)).toContainText(MAGASINS[1])
  await expect(lignes.nth(1)).toContainText(`janvier ${N}`)
  await expect(lignes.nth(2)).toContainText(MAGASINS[0])
  await expect(lignes.nth(2)).toContainText(/1,5\s?%/)
  await expect(lignes.nth(2)).toContainText(new RegExp(`février ${N} \\(3\\s?%\\)`))

  await expect(carte).toContainText(`${MAGASINS[2]} ancien : 4 lignes dans le pilotage. Renommé ${MAGASINS[2]} dans l’app réseau.`)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await carte.screenshot({ path: `captures/${info.project.name}-preparation-fusion.png` })

  await carte.getByRole('button', { name: `Rattacher à ${MAGASINS[2]}` }).click()
  await expect(carte.getByText(`Données de « ${MAGASINS[2]} ancien » rattachées à ${MAGASINS[2]} : 3 lignes. 1 ligne déjà présente sous ${MAGASINS[2]} est restée sous l’ancien nom, pour ne rien écraser.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/renommer_magasin')?.corps).toEqual({ p_ancien: `${MAGASINS[2]} ancien`, p_nouveau: MAGASINS[2] })
  await expect(carte.getByRole('button', { name: /Rattacher/ })).toHaveCount(0)

  // L'année d'avant : rien à comparer, l'écran le dit
  await carte.getByRole('button', { name: String(N - 1), exact: true }).click()
  await expect(carte.getByText(`Rien à comparer en ${N - 1}`)).toBeVisible()
})

test('tant que la base n’a pas la mise à jour 0028, la carte le dit sans erreur', async ({ page }) => {
  await seConnecter(page, {})
  await allerVers(page, 'Imports de caisse')
  const carte = page.getByRole('region', { name: 'Avant la fusion avec l’app réseau' })
  await expect(carte.getByText('Ce contrôle sera disponible quand la mise à jour 0028 de la base aura été passée.')).toBeVisible()
  await expect(carte.getByRole('table')).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type VenteSimulee } from './supabase-simule'

// Écrans du budget clarifiés (Joseph, 03/11/2026) : cartes qui disent quoi remplir, questions du Calendrier, saisonnalité
// au point de départ, simulateur unique, (i) sur les lignes calculées, date d'ouverture de la fiche magasin réseau,
// plus de magasin imposé en haut, barre du haut de l'app réseau. Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0)
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const propose = (s: Partial<MagasinSimule> = {}): MagasinSimule =>
  ({ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-20T09:30:00Z', ajustements: {}, ajustements_siege: {}, ...s })
const reel: VenteSimulee[] = [
  { store_name: MAGASINS[0], mois: mois(N, 1), univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 3_600 },
  { store_name: MAGASINS[0], mois: mois(N, 2), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 7_200 },
  ...Array.from({ length: 12 }, (_, i) => ({ store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Vin', ca_ht: i === 11 ? 4_000 : 1_000, ca_ttc: null, marge_ht: null })),
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('Construire : toutes les hypothèses en cartes, chacune dit ce qu’il reste à faire', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose()] })
  await ouvrir(page, 'Construire')
  const cartes = page.getByRole('region', { name: `Hypothèses ${B} en cartes` })
  await expect(cartes.getByRole('region', { name: 'Ventes Cave' })).toContainText('Tickets')
  await expect(cartes.getByRole('region', { name: 'Ventes Cave' })).toContainText('Marge visée')
  const calendrier = cartes.getByRole('region', { name: 'Calendrier', exact: true })
  await expect(calendrier).toContainText('À faire')
  await expect(calendrier).toContainText('À répondre')
  await expect(calendrier.getByRole('link')).toContainText('Remplir')
  // Le tableau des ventes n'est plus sur la page : il s'ouvre depuis la carte de l'univers
  await expect(page.getByRole('table', { name: /Hypothèses \d+ : Cave/ })).toBeHidden()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ecrans-cartes.png`, fullPage: true })

  await cartes.getByRole('region', { name: 'Ventes Cave' }).getByRole('link').click()
  await expect(page.getByRole('table', { name: /Hypothèses \d+ : Cave/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: `Ventes et marge ${B}` })).toBeVisible()
})

test('Calendrier : trois questions, « Rien de prévu » répond, la carte passe à « Fait »', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose()] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Calendrier')
  const questions = page.getByRole('region', { name: 'Questions du calendrier' })
  await expect(questions).toContainText(`1. Des travaux ou une fermeture en ${B} ?`)
  await expect(questions.getByText('À répondre', { exact: true })).toHaveCount(3)
  // La saisonnalité n'est plus dans le Calendrier
  await expect(page.locator('main').getByRole('region', { name: 'Saisonnalité', exact: true })).toBeHidden()
  for (const q of ['travaux ou fermeture', 'temps forts', 'clients gagnés ou perdus']) await questions.getByRole('button', { name: `Rien de prévu : ${q}` }).click()
  await expect(questions.getByText('Rien de prévu', { exact: true })).toHaveCount(3)
  await expect(questions).toContainText('Fait')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ecrans-questions.png`, fullPage: true })
  // « Oui, saisir » mène au bloc ; une saisie répond à la question
  await questions.getByRole('button', { name: 'Annuler la réponse : temps forts' }).click()
  await questions.getByRole('button', { name: 'Oui, saisir : temps forts' }).click()
  await page.getByRole('button', { name: 'Prévoir un temps fort' }).click()
  await expect(questions).toContainText('Oui, 1 temps fort prévu')
  await page.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  await expect(page.getByRole('region', { name: 'Calendrier', exact: true })).toContainText('Fait')
})

test('point de départ : la saisonnalité finit l’année et répartit le budget ; la date d’ouverture vient de la fiche magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose()], reel, ouverturesReseau: [{ store_name: MAGASINS[0], ouverture: '2019-03-01' }] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Point de départ')
  const saison = page.getByRole('region', { name: 'Saisonnalité', exact: true })
  await expect(saison.getByRole('table', { name: `Mois restants ${N} par univers` })).toBeVisible()
  await expect(saison.getByRole('region', { name: `Saisonnalité du budget ${B}` })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Projection des mois restants' })).toHaveCount(0)
  const base = page.getByRole('region', { name: 'Base du CA' })
  await expect(base).toContainText('Ouvert en mars 2019, d’après la fiche magasin')
  await expect(base.getByLabel('Mois d’ouverture du magasin')).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ecrans-depart.png`, fullPage: true })
})

test('sans date dans la fiche magasin, le Directeur la saisit en secours', async ({ page }) => {
  await seConnecter(page, { magasins: [propose()], reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Point de départ')
  const base = page.getByRole('region', { name: 'Base du CA' })
  await expect(base).toContainText('Date d’ouverture inconnue de la fiche magasin')
  await expect(base.getByLabel('Mois d’ouverture du magasin')).toBeVisible()
})

test('« Que faut-il pour… » : un EBE ou une rémunération du gérant, avec le CA à atteindre', async ({ page, isMobile }) => {
  await seConnecter(page, { magasins: [propose()] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  await expect(page.getByRole('region', { name: 'Économie du franchisé' }).getByLabel('Rémunération du gérant visée')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Objectif d’EBE' })).toHaveCount(0)
  const sim = page.getByRole('region', { name: 'Que faut-il pour…' })
  await sim.getByRole('button', { name: 'Une rémunération du gérant' }).click()
  await sim.getByLabel('Rémunération du gérant visée').fill('90000')
  await expect(sim).toContainText(/CA à atteindre : .+ \([+−-][\d,]+\s%\ssur le budget\)/)
  const leviers = sim.getByRole('table', { name: 'Leviers pour atteindre : rémunération du gérant visée' })
  await expect(leviers.getByRole('row', { name: /^Masse salariale/ })).toHaveCount(0)
  await sim.getByRole('button', { name: 'Un EBE' }).click()
  await sim.getByLabel('EBE visé').fill('200000')
  await expect(sim.getByRole('table', { name: 'Leviers pour atteindre : ebe visé' }).getByRole('row', { name: /^Masse salariale/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('un (i) sur les totaux : décaissements, variation du mois, chiffre d’affaires', async ({ page }) => {
  await seConnecter(page, { magasins: [propose()] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  const treso = page.getByRole('region', { name: `Trésorerie ${B}` })
  const detail = treso.getByRole('button', { name: /Voir le détail|Détail/ })
  if (await detail.count()) await detail.first().click()
  await expect(treso.getByRole('button', { name: 'Aide : Total des décaissements' })).toBeVisible()
  await expect(treso.getByRole('button', { name: 'Aide : Variation du mois' })).toBeVisible()
  await expect(treso.getByRole('button', { name: 'Aide : Trésorerie en fin de mois' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aide : Chiffre d’affaires HT' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aide : Résultat avant impôt' }).first()).toBeVisible()
})

test('plus de magasin imposé en haut ; barre du haut de l’app réseau', async ({ page, isMobile }) => {
  await seConnecter(page)
  const barre = page.getByRole('banner')
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.locator('main').getByRole('button', { name: `Changer de magasin (magasin ouvert : ${MAGASINS[0]})` })).toBeVisible()
  await expect(barre.getByRole('button', { name: /Changer de magasin/ })).toHaveCount(0)
  // Retour au réseau : aucun magasin ne reste ouvert
  await page.locator('main').getByRole('link', { name: 'Magasins' }).first().click()
  await expect(page.locator('main').getByRole('button', { name: /Changer de magasin/ })).toHaveCount(0)
  if (!isMobile) {
    await expect(page.getByRole('navigation', { name: 'Pages du magasin' })).toHaveCount(0)
    const haut = await barre.locator('.MuiToolbar-root').boundingBox()
    expect(haut?.height).toBe(68)
    const recherche = await barre.getByRole('combobox', { name: 'Rechercher un magasin' }).locator('..').boundingBox()
    expect(recherche?.height).toBe(44)
  }
})

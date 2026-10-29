import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type ActionSimulee, type MagasinSimule, type VenteSimulee, plusLoin } from './supabase-simule'

// Lot 29 : économie du franchisé, familles face au réseau, « Ma semaine » dans la vue Réseau. Données fictives : dépôt public.
const N = new Date().getFullYear()
const k = Math.max(3, new Date().getMonth())
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
// Premier magasin : CA −10 % et marge −2 points sur l'an dernier ; deuxième : stable. Les deux sont sous leur budget
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 27_000, ca_ttc: 32_400, marge_ht: 10_260 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 30_000, ca_ttc: 36_000, marge_ht: 12_000 },
  { store_name: MAGASINS[1], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 30_000, ca_ttc: 36_000, marge_ht: 12_000 },
  { store_name: MAGASINS[1], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 30_000, ca_ttc: 36_000, marge_ht: 12_000 },
] as VenteSimulee[]).flat()
const coachs = { [MAGASINS[0]]: 'Coach Nord', [MAGASINS[1]]: 'Coach Sud', [MAGASINS[2]]: 'Coach Sud' }
const action: ActionSimulee = {
  id: 1, store_name: MAGASINS[0], type_alerte: 'marge', intitule: 'Revoir le mix', responsable: 'coach', echeance: `${N - 1}-12-31`,
  statut: 'a_faire', annee: N, depart: -0.02, mois_depart: k, cree_par_role: 'directeur', cree_par_nom: null, cree_le: `${N}-01-15T10:00:00Z`, faite_le: null,
}
// Trois magasins avec des familles : la médiane du réseau s'affiche
const troisMagasins: MagasinSimule[] = MAGASINS.slice(0, 3).map((m, i) => ({ magasin: m, statut: 'valide', hypotheses: magasinFictif, maj_le: `2026-10-2${i}T09:00:00Z` }))

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('économie du franchisé : point mort, marge de sécurité, CA à atteindre pour une rémunération visée', async ({ page, isMobile }, info) => {
  await seConnecter(page)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  const eco = page.getByRole('region', { name: 'Économie du franchisé' })
  await expect(eco).toContainText('Point mort')
  await expect(eco).toContainText('Marge de sécurité')
  await expect(eco).toContainText('Reste disponible')
  await expect(eco).not.toContainText('CA à atteindre')
  await eco.getByLabel('Rémunération du gérant visée').fill('60000')
  await expect(eco).toContainText(/CA à atteindre : .+ \([+−-][\d,]+\s%\ssur le budget\)/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-economie.png`, fullPage: true })
})

test('économie du franchisé : visible par le franchisé sur son magasin', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: null }] })
  await ouvrir(page, 'Résultat')
  await expect(page.getByRole('region', { name: 'Économie du franchisé' })).toContainText('Point mort')
})

test('familles face au réseau : poids, marge et médianes à partir de trois magasins', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: troisMagasins })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await plusLoin(page)
  const region = page.getByRole('region', { name: 'Familles face au réseau' })
  const tableau = region.getByRole('table', { name: `Familles de ${MAGASINS[0]} face au réseau` })
  await expect(tableau.getByRole('columnheader', { name: 'Poids dans l’univers' })).toBeVisible()
  await expect(tableau.getByRole('row')).not.toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-familles.png`, fullPage: true })
})

test('familles face au réseau : cachées sous trois magasins et pour le franchisé', async ({ page }) => {
  await seConnecter(page)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('tablist', { name: 'Vues du magasin' })).toBeVisible()
  await plusLoin(page)
  await expect(page.getByRole('region', { name: 'Familles face au réseau' })).toHaveCount(0)
})

test('franchisé : pas de comparaison des familles', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: troisMagasins.slice(0, 1) })
  await expect(page.getByRole('tablist', { name: 'Vues du magasin' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Familles face au réseau' })).toHaveCount(0)
})

test('ma semaine : magasins par marge en jeu, actions en retard, par Coach', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, coachs, actions: [action] })
  await page.getByRole('link', { name: /Réseau/ }).first().click()
  const semaine = page.getByRole('region', { name: 'Ma semaine' })
  const lignes = semaine.getByRole('table', { name: 'Magasins par marge en jeu' }).getByRole('row')
  await expect(lignes.nth(1)).toContainText(MAGASINS[0])
  await expect(lignes.nth(1)).toContainText('Coach Nord')
  await expect(lignes.nth(1)).toContainText(/CA [-−][\d,]+\s%\sface au budget/)
  await expect(lignes.nth(1).getByRole('cell').last()).toHaveText('1')
  await expect(lignes.nth(2)).toContainText(MAGASINS[1])
  await expect(semaine.getByRole('table', { name: 'Marge en jeu par Coach' })).toContainText('Coach Nord')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-ma-semaine.png`, fullPage: true })
  await lignes.nth(1).getByRole('link', { name: MAGASINS[0] }).click()
  await expect(page.getByRole('tablist', { name: 'Vues du magasin' })).toBeVisible()
})

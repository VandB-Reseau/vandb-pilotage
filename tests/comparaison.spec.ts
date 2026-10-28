import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type VenteSimulee } from './supabase-simule'

// Comparaison aux médianes : fiche magasin et vue Réseau. Données fictives : dépôt public.
// Budgets : 640 000 € de CA chacun, loyers de 60 000, 40 000 et 80 000 € (9,4 %, 6,3 %, 12,5 % du CA) ;
// EBE de 54 780, 74 780 et 34 780 € (8,6 %, 11,7 %, 5,4 %).

const N = new Date().getFullYear()
const annee = N + (new Date().getMonth() >= 8 ? 1 : 0)   // année des budgets, comme anneeBudget()
const avecLoyer = (loyer: number) => ({ ...magasinFictif, frais: magasinFictif.frais.map((f) => (f.code === 'loyer' ? { ...f, annuel: loyer } : f)) })
const magasins: MagasinSimule[] = [60_000, 40_000, 80_000].map((loyer, i) => ({ magasin: MAGASINS[i], statut: 'valide', hypotheses: avecLoyer(loyer), maj_le: null }))
// Réel de janvier : 40 %, 30 % et 50 % de marge
const reel: VenteSimulee[] = [4_000, 3_000, 5_000].map((marge, i) => ({ store_name: MAGASINS[i], mois: `${N}-01-01`, univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: marge }))

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche magasin : face à la médiane des budgets, puis du réel', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins, reel })
  await page.getByText(MAGASINS[1], { exact: true }).last().click()
  const section = page.getByRole('region', { name: 'Face au réseau' })
  const tableau = section.getByRole('table', { name: `${MAGASINS[1]} face aux médianes` })
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  // Réel d'abord : 30 % de marge contre 40 % de médiane, 3e sur 3
  await expect(ligne('Taux de marge')).toContainText(/^Taux de marge30,0\s%40,0\s%3e sur 3$/)
  await section.getByRole('button', { name: `Budgets ${annee}` }).click()
  await expect(ligne('Loyer / CA')).toContainText(/^Loyer \/ CA6,3\s%9,4\s%1er sur 3$/)
  await expect(ligne('EBE / CA')).toContainText(/^EBE \/ CA11,7\s%8,6\s%1er sur 3$/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.screenshot({ path: `captures/${info.project.name}-comparaison.png` })
})

test('vue Réseau : ligne de la médiane et colonne loyer / CA', async ({ page }) => {
  await seConnecter(page, { magasins, reel })
  await page.getByRole('link', { name: /Réseau/ }).first().click()
  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  await expect(tableau.getByRole('columnheader', { name: 'Loyer / CA' })).toBeVisible()
  await expect(tableau.getByRole('row', { name: /Médiane du réseau/ })).toContainText('40,0')
})

test('le franchisé ne voit pas la comparaison', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins, reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('tab', { name: 'Synthèse' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Face au réseau' })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { ouvrir, plusLoin, seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Écrans allégés (Joseph, 03/11/2026) : l'Extérieur dans les leviers commerciaux, la saisie du réel par univers.
// Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
// Janvier et février détaillés : Cave Bière 6 000 € et Vin 4 000 € chaque mois ; Bar Fût 10 000 € ; Extérieur 5 000 €
const reel: VenteSimulee[] = [1, 2].flatMap((m) => [
  { store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 6_000, ca_ttc: 7_200, marge_ht: 1_800 },
  { store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Vin', ca_ht: 4_000, ca_ttc: 4_800, marge_ht: 1_600 },
  { store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'bar', famille: 'Fût', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 7_400 },
  { store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'exterieur', famille: 'Factures', ca_ht: 5_000, ca_ttc: 6_000, marge_ht: 2_000 },
])
const tickets: TicketsSimules[] = [{ store_name: MAGASINS[0], mois: `${N}-01-01`, univers: 'cave', tickets: 600 }]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('leviers commerciaux : l’Extérieur a son « CA en plus » et son mix, sans tickets ni panier', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await plusLoin(page)
  const leviers = page.getByRole('region', { name: 'Leviers commerciaux' })
  const ext = leviers.getByRole('group', { name: 'Extérieur' })
  await expect(ext).toContainText('sans tickets')
  await expect(ext.getByLabel('Panier en plus : Extérieur')).toHaveCount(0)
  await expect(leviers.getByLabel('Effet sur un an')).toContainText(/CA \+0\sk€/)
  await ext.getByLabel('CA en plus : Extérieur').fill('10')
  await expect(leviers.getByLabel('Effet sur un an')).not.toContainText(/CA \+0\sk€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await leviers.screenshot({ path: `captures/${info.project.name}-leviers-exterieur.png` })
  await leviers.getByRole('button', { name: 'En faire une action' }).click()
  await expect(page.getByRole('form', { name: 'Nouvelle action' }).getByLabel('Action')).toHaveValue(/^Extérieur : \+10,0\s%\sde CA \(/)
})

test('réel du mois : le CA de la Cave saisi d’un bloc est enregistré « Non détaillé » et réparti comme les mois précédents', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'coach', reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Réel')
  await page.getByRole('button', { name: 'Saisir un mois' }).click()
  const saisie = page.getByRole('region', { name: /Réel du mois/ })
  await expect(saisie.getByLabel('Mois')).toContainText(`mars ${N}`)
  const cave = saisie.getByRole('group', { name: 'Ventes Cave' })
  await expect(cave).toContainText('Réparti sur les familles comme les 3 mois précédents')
  await cave.getByLabel('CA HT : Cave').fill('20000')
  await cave.getByLabel('Marge HT : Cave').fill('6800')
  // CA TTC déduit du rapport TTC / HT des mois précédents : 20 000 × 1,2
  await expect(cave).toContainText(/CA TTC · ≈ 24\s000/)
  await cave.getByLabel('Tickets Cave').fill('800')
  // L'Extérieur, à famille unique, n'a pas de détail
  await expect(saisie.getByRole('group', { name: 'Ventes Extérieur' }).getByRole('button', { name: /Détailler/ })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await saisie.screenshot({ path: `captures/${info.project.name}-saisie-univers.png` })
  await saisie.getByRole('button', { name: 'Enregistrer le mois' }).click()
  await expect(page.getByText(`Réel de mars ${N} enregistré.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/remplacer_reel')?.corps).toEqual({
    p_ventes: [{ store_name: MAGASINS[0], mois: `${N}-03-01`, univers: 'cave', famille: 'Non détaillé', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 6_800 }],
    p_tickets: [{ store_name: MAGASINS[0], mois: `${N}-03-01`, univers: 'cave', tickets: 800 }],
  })
  // Lecture : Bière 60 % → ≈ 12 000 € en mars, en italique ; le total de la Cave reste juste
  const tableau = page.getByRole('table', { name: `Réel ${N} par famille et par mois` })
  await expect(tableau.getByRole('row', { name: /Bière \(Cave\)/ })).toContainText(/≈ 12\s000/)
  await expect(tableau.getByRole('row', { name: /Bière \(Cave\)/ })).toContainText(/24\s000\s€/)
  await expect(page.getByText('≈ en italique : réparti selon les mois précédents')).toBeVisible()

  // Rouvrir mars : la saisie par univers revient ; détailler pré-remplit les familles
  await page.getByRole('button', { name: `Saisir mars ${N}` }).click()
  await expect(cave.getByLabel('CA HT : Cave')).toHaveValue('20000')
  await cave.getByRole('button', { name: 'Détailler par famille (conseillé)' }).click()
  await expect(cave.getByLabel('CA HT : Bière (Cave)')).toHaveValue('12000')
  await expect(cave.getByLabel('Marge HT : Vin (Cave)')).toHaveValue(/^3/)
  await expect(cave).toContainText(/Total des familles : CA HT 20\s000\s€/)
})

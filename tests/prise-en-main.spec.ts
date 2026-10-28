import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Prise en main (lot 25) : recherche d'un magasin depuis tout écran, aide derrière les icônes, calcul détaillé du budget.
// Données fictives : dépôt public. Les montants viennent du moteur, vérifié à la main dans tests/moteur/explication.spec.ts.

const reseau = { evolutionFlux: { cave: 0.03 }, evolutionUnivers: { bar: 0.03, exterieur: 0 } }
const magasins: MagasinSimule[] = MAGASINS.map((magasin) => ({ magasin, statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }))

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('on retrouve un magasin depuis n’importe quel écran, sans accent ni majuscule, les derniers consultés en tête', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins, reseau })
  const chercher = async (texte: string) => {
    if (isMobile) await page.getByRole('button', { name: 'Rechercher un magasin' }).click()
    const champ = page.getByRole('combobox', { name: 'Rechercher un magasin' })
    await champ.fill(texte)
    return champ
  }
  await chercher('aubin des pres')
  await page.getByRole('option', { name: MAGASINS[2] }).click()
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[2] })).toBeVisible()

  // Depuis la fiche, on passe à un autre magasin ; le précédent reste dans les récents
  await chercher('VALC')
  await page.getByRole('option', { name: MAGASINS[1] }).click()
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[1] })).toBeVisible()

  if (isMobile) await page.getByRole('button', { name: 'Rechercher un magasin' }).click()
  else await page.keyboard.press('Control+k')
  const champ = page.getByRole('combobox', { name: 'Rechercher un magasin' })
  await expect(champ).toBeFocused()
  await champ.press('ArrowDown')
  const liste = page.getByRole('listbox')
  await expect(liste.getByRole('group', { name: 'Consultés récemment' }).or(liste.getByText('Consultés récemment'))).toBeVisible()
  await expect(liste.getByRole('option').first()).toHaveText(MAGASINS[1])
  await expect(liste.getByRole('option').nth(1)).toHaveText(MAGASINS[2])
  await champ.fill('zzz')
  await expect(page.getByText('Aucun magasin ne correspond')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-recherche.png` })
})

test('un franchisé avec un seul magasin n’a pas de recherche', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: magasins.slice(0, 1), reseau })
  await expect(page.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Rechercher un magasin' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Rechercher un magasin' })).toHaveCount(0)
})

test('le franchisé ouvre l’aide d’une hypothèse et voit d’où viennent son CA et son EBE', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: magasins.slice(0, 1), reseau })
  await page.getByRole('tab', { name: /^Budget/ }).click()

  await page.getByRole('button', { name: 'Aide : Évolution du nombre de tickets' }).first().click()
  const aide = page.getByRole('dialog', { name: 'Évolution du nombre de tickets' })
  await expect(aide).toContainText('Comment le remplir')
  await expect(aide).toContainText('CA de l’univers = base × (1 + tickets) × (1 + panier).')
  expect(await textesTropPetits(page)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(aide).toHaveCount(0)
  await ouvrir(page, 'Calendrier')
  await page.getByRole('button', { name: 'Aide : Saisonnalité' }).click()
  await expect(page.getByRole('dialog', { name: 'Saisonnalité' })).toContainText('ramenées à 100 %')
  await page.keyboard.press('Escape')

  // CA : Cave 200 000 × 1,03 (tickets), Bar 300 000 × 1,03, Extérieur 100 000
  await page.getByRole('button', { name: 'D’où vient ce chiffre ? Chiffre d’affaires HT' }).click()
  const calcul = page.getByRole('table', { name: 'Calcul : Chiffre d’affaires HT 2027' })
  await expect(calcul.getByRole('row', { name: /^CA 2026 attendu/ }).first()).toContainText(/200\s000\s€/)
  await expect(calcul.getByRole('row', { name: /^Évolution des tickets/ })).toContainText(/\+3,0\s%/)
  await expect(calcul.getByRole('row', { name: /^Évolution des tickets/ })).toContainText(/206\s000\s€/)
  await expect(calcul.getByRole('row', { name: /^Évolution des familles/ })).toContainText(/309\s000\s€/)
  await expect(calcul.getByRole('row').last()).toContainText(/615\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-calcul-ca.png` })
  await page.getByRole('button', { name: 'Fermer' }).click()

  await page.getByRole('button', { name: 'D’où vient ce chiffre ? EBE' }).click()
  const ebe = page.getByRole('table', { name: 'Calcul : EBE 2027' })
  // Redevance 2 % de 615 000
  await expect(ebe.getByRole('row', { name: /^Redevance/ })).toContainText(/[-−]12\s300\s€/)
  await expect(ebe.getByRole('row').last()).toContainText('EBE 2027')
})

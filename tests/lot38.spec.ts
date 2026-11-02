import { expect, test } from '@playwright/test'
import { MAGASINS, magasinFictif } from './donnees-fictives'
import { anneeEnTete, ouvrir, partieAffichee, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 38 : une seule navigation, un en-tête de magasin, lignes clés teintées, paramètres figés à la validation.
// Magasin fictif (tests/donnees-fictives.ts) : 640 000 € de CA. Données fictives uniquement : dépôt public.

const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('budget : une seule navigation, l’étape suivante en bas de page, un en-tête unique', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Cartes des hypothèses')
  // D1 : sur PC, plus d'onglets d'étapes en tête de page (le menu de gauche suffit) ; sur téléphone, ils restent
  await expect(page.locator('main').getByRole('tablist')).toHaveCount(isMobile ? 1 : 0)
  // D2 : nom, budget et statut une seule fois, actions dans l'en-tête
  const entete = page.locator('main header')
  await expect(entete.getByRole('heading', { level: 1, name: MAGASINS[0] })).toBeVisible()
  const annee = await anneeEnTete(page)
  expect(annee).toBeGreaterThan(2025)
  await expect(entete).toContainText('Proposé par le siège')
  await expect(page.locator('main').getByText('Proposé par le siège')).toHaveCount(1)
  await expect(entete.getByRole('button', { name: 'Exporter en Excel' })).toBeVisible()

  // Étape suivante, puis précédente
  const pied = page.getByRole('navigation', { name: 'Étape précédente ou suivante' })
  await expect(pied).toContainText('Étape 1 sur 3')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot38-hypotheses.png`, fullPage: true })
  await pied.getByRole('button', { name: 'Étape suivante : Résultat et trésorerie' }).click()
  await expect(page).toHaveURL(/\/resultat$/)
  await partieAffichee(page, /^2 · Résultat et trésorerie/)
  // D5 : CA, marge, frais de personnel et EBE sur fond teinté dans le compte de résultat
  const compte = page.getByRole('table', { name: `Budget ${annee} mois par mois` })
  for (const nom of [/^Chiffre d’affaires HT/, /^Marge commerciale/, /^Frais de personnel/, /^Excédent brut d’exploitation/]) {
    await expect(compte.getByRole('row', { name: nom })).toHaveClass(/ligne-cle/)
  }
  // 2/11/2026 : résultat d'exploitation, résultat net et trésorerie dégagée aussi ; pas les intérêts
  for (const nom of [/^Résultat d’exploitation/, /^Résultat net/, /^Trésorerie dégagée après emprunts/]) {
    await expect(compte.getByRole('row', { name: nom })).toHaveClass(/ligne-cle/)
  }
  await expect(compte.getByRole('row', { name: /^Intérêts/ })).not.toHaveClass(/ligne-cle/)
  await page.screenshot({ path: `captures/${info.project.name}-lot38-resultat.png`, fullPage: true })
  await page.getByRole('navigation', { name: 'Étape précédente ou suivante' }).getByRole('button', { name: 'Hypothèses' }).click()
  await expect(page).toHaveURL(/\/budget$/)
})

// Paramètres du moment : redevance 2 % + publicité 1 % = 3 % du CA. Copie faite à la validation : redevance 5 % → 6 %.
// Budget validé : hypothèses figées, 640 000 € de CA → 38 400 €.
async function redevances(page: import('@playwright/test').Page) {
  await ouvrir(page, 'Résultat et trésorerie')
  const annee = await anneeEnTete(page)
  await page.getByRole('button', { name: /^Charges externes : détailler/ }).click()
  return page.getByRole('table', { name: `Budget ${annee} mois par mois` }).getByRole('row', { name: /^Redevances du réseau/ })
}
test('budget validé : calculé avec les paramètres du jour de la validation, pas ceux du moment', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ ...propose, statut: 'valide', parametres: { tauxRedevance: 0.05 } }] })
  await expect(await redevances(page)).toContainText(/[-−]38\s400\s€[-−]6,0\s%$/)
})
test('budget rouvert : il suit de nouveau les paramètres du moment', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ ...propose, statut: 'en_discussion', parametres: { tauxRedevance: 0.05 } }] })
  await expect(await redevances(page)).toContainText(/[-−]3,0\s%$/)
})

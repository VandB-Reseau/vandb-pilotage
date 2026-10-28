import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type QuadrimestreSimule, type VenteSimulee } from './supabase-simule'

// Alertes : accueil, vue Réseau, fiche magasin, seuils dans Paramètres réseau. Données fictives : dépôt public.
// Budget validé du premier magasin : 48 000 € de CA en janvier (tests/suivi.spec.ts).

const N = new Date().getFullYear()
const M = new Date().getMonth()                  // mois terminés : rien d'attendu en janvier
const k = Math.max(1, M)
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
// Premier magasin : 20 000 € par mois à 36 % de marge, contre 40 000 € à 40 % l'an dernier
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 7_200 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 40_000, ca_ttc: 48_000, marge_ht: 16_000 },
]).flat()
// Troisième magasin : 4 000 € de découvert fin avril
const quadrimestres: QuadrimestreSimule[] = [{ store_name: MAGASINS[2], annee: N, quadrimestre: 1, achats: 100_000, variation_stock: 0, charges_externes: 20_000, impots_taxes: 2_000, personnel: 30_000, tresorerie: -4_000 }]
const nbAlertes = 3 + (M >= 1 ? 2 : 0)           // CA, marge, trésorerie ; réel absent des deux autres magasins après janvier

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('accueil : alertes des magasins, les plus graves d’abord, filtre par type, lien vers le bon onglet', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, quadrimestres })
  const alertes = page.getByRole('region', { name: 'Alertes' })
  await expect(alertes.getByRole('heading')).toHaveText(`${nbAlertes} alertes`)
  const lignes = alertes.getByRole('listitem')
  await expect(lignes.first()).toContainText(new RegExp(`${MAGASINS[2]}Trésorerie de [-−]4\\s000\\s€ fin avril`))
  await expect(lignes.nth(1)).toContainText(new RegExp(`${MAGASINS[0]}CA [-−]\\d+,\\d\\s%\\sface au budget`))
  await expect(lignes.nth(2)).toContainText(/Taux de marge de 36,0\s%, [-−]4,0 pt sur l’an dernier/)
  if (M >= 1) await expect(lignes.nth(3)).toContainText('Aucun mois de réel cette année')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await alertes.screenshot({ path: `captures/${info.project.name}-alertes.png` })

  await alertes.getByRole('button', { name: 'Marge en baisse (1)' }).click()
  await expect(lignes).toHaveCount(1)
  await alertes.getByRole('button', { name: 'Marge en baisse (1)' }).click()
  await expect(lignes).toHaveCount(nbAlertes)
  // La trésorerie se lit dans l'onglet Quadrimestres
  await lignes.first().getByRole('link', { name: MAGASINS[2] }).click()
  await expect(page.getByRole('tab', { name: 'Quadrimestres' })).toHaveAttribute('aria-selected', 'true')
})

test('fiche magasin : ses alertes en tête de la synthèse ; vue Réseau filtrée', async ({ page }) => {
  await seConnecter(page, { reel, quadrimestres })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const alertes = page.getByRole('region', { name: 'Alertes' })
  await expect(alertes.getByRole('heading')).toHaveText('2 alertes')
  await expect(alertes.getByRole('link')).toHaveCount(0)

  await page.getByRole('link', { name: /Réseau/ }).first().click()
  const reseau = page.getByRole('region', { name: 'Alertes' })
  await expect(reseau.getByRole('heading')).toHaveText(`${nbAlertes} alertes`)
  await page.getByLabel('Rechercher un magasin').fill('Saint')
  await expect(reseau.getByRole('heading')).toHaveText(M >= 1 ? '2 alertes' : '1 alerte')
})

test('paramètres réseau : le Directeur règle les seuils, les alertes suivent', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { reel, quadrimestres })
  await page.getByRole('link', { name: /Paramètres/ }).first().click()
  const section = page.getByRole('region', { name: 'Alertes' })
  const enregistrer = section.getByRole('button', { name: 'Enregistrer' })
  await expect(page.getByLabel('Baisse du taux de marge')).toHaveValue('1')
  await expect(enregistrer).toBeDisabled()
  await page.getByLabel('Baisse du taux de marge').fill('5')
  await page.getByLabel('Seuil de trésorerie').fill('-5000')
  await page.getByLabel('Mois de réel manquants').fill('0')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await enregistrer.click()
  await expect(page.getByText('Seuils des alertes enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { alertes: unknown } }
  expect(envoi.valeur.alertes).toEqual({ ecartCA: 0.05, baisseMarge: 0.05, moisRetard: 0, tresorerie: -5_000 })

  // Il ne reste que le CA sous le budget
  await page.getByRole('link', { name: /Magasins/ }).first().click()
  await expect(page.getByRole('region', { name: 'Alertes' }).getByRole('heading')).toHaveText('1 alerte')
})

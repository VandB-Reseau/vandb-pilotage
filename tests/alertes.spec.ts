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

test('vue Réseau : les alertes de chaque magasin dans Ma semaine ; « À traiter » y renvoie', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, quadrimestres })
  // Lot 30 (E3) : plus de liste d'alertes sur l'accueil du siège, « À traiter » mène à Ma semaine
  await expect(page.getByRole('region', { name: 'Alertes' })).toHaveCount(0)
  const aTraiter = page.getByRole('region', { name: 'À traiter' })
  await expect(aTraiter).toContainText(`${M >= 1 ? 3 : 2} magasins en alerte`)
  await aTraiter.getByRole('link', { name: 'Voir dans Ma semaine' }).click()
  const semaine = page.getByRole('region', { name: 'Ma semaine' })
  const premier = semaine.getByRole('list', { name: `Alertes de ${MAGASINS[0]}` }).getByRole('listitem')
  await expect(premier).toHaveText(['CA sous le budget', 'Marge en baisse'])
  await expect(premier.nth(1)).toHaveAttribute('aria-label', /Taux de marge de 36,0\s%, [-−]4,0 pt sur l’an dernier/)
  const troisieme = semaine.getByRole('list', { name: `Alertes de ${MAGASINS[2]}` }).getByRole('listitem')
  await expect(troisieme.first()).toHaveAttribute('aria-label', /Trésorerie de [-−]4\s000\s€ fin avril/)
  if (M >= 1) await expect(semaine.getByRole('list', { name: `Alertes de ${MAGASINS[1]}` })).toContainText('Réel en retard')
  await expect(semaine.getByRole('listitem')).toHaveCount(nbAlertes)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await semaine.screenshot({ path: `captures/${info.project.name}-alertes.png` })
  // La liste suit le filtre de la page
  await page.getByLabel('Filtrer la liste des magasins').fill('Saint')
  await expect(semaine.getByRole('listitem')).toHaveCount(M >= 1 ? 2 : 1)
})

test('fiche magasin : ses alertes en tête de la synthèse', async ({ page }) => {
  await seConnecter(page, { reel, quadrimestres })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const alertes = page.getByRole('region', { name: 'Alertes' })
  await expect(alertes.getByRole('heading')).toHaveText('2 alertes')
  await expect(alertes.getByRole('link')).toHaveCount(0)
})

test('paramètres réseau : le Directeur règle les seuils, les alertes suivent', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { reel, quadrimestres })
  await page.getByRole('link', { name: /Paramètres/ }).first().click()
  const section = page.getByRole('region', { name: 'Alertes' })
  await expect(section).toContainText('Valeurs par défaut')
  await section.getByRole('button', { name: 'Alertes : ouvrir' }).click()
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
  expect(envoi.valeur.alertes).toEqual({ ecartCA: 0.05, baisseMarge: 0.05, moisRetard: 0, tresorerie: -5_000, baisseTickets: 0.05, baissePanier: 0.03 })

  await expect(section).not.toContainText('Valeurs par défaut')
  // Il ne reste que le CA sous le budget
  await page.getByRole('link', { name: /Réseau/ }).first().click()
  await expect(page.getByRole('region', { name: 'Ma semaine' }).getByRole('listitem')).toHaveCount(1)
})

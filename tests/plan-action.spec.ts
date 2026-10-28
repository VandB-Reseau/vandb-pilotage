import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type ActionSimulee, type VenteSimulee } from './supabase-simule'

// Plan d'action relié aux alertes. Mêmes données fictives que tests/alertes.spec.ts : le premier magasin vend 20 000 €
// par mois à 36 % de marge, contre 40 000 € à 40 % l'an dernier (marge −4 points, CA sous le budget).

const N = new Date().getFullYear()
const k = Math.max(1, new Date().getMonth())
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 7_200 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 40_000, ca_ttc: 48_000, marge_ht: 16_000 },
]).flat()
const action: ActionSimulee = {
  id: 7, store_name: MAGASINS[0], type_alerte: 'ca', intitule: 'Relancer la vente additionnelle en caisse', responsable: 'franchise', echeance: `${N + 1}-01-15`,
  statut: 'a_faire', annee: N, depart: -0.2, mois_depart: k, cree_par_role: 'coach', cree_par_nom: 'Coach Nord', cree_le: `${N}-10-01T09:00:00Z`, faite_le: null,
}

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur rattache une action à l’alerte de marge et en suit la mesure', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  await expect(plan).toContainText('Aucune action en cours.')
  const alertes = page.getByRole('region', { name: 'Alertes' })
  await alertes.getByRole('button', { name: /^Agir : Taux de marge de 36,0/ }).click()

  const form = plan.getByRole('form', { name: 'Nouvelle action' })
  await expect(form.getByRole('combobox', { name: 'Répond à' })).toContainText('Taux de marge de 36,0')
  await expect(form.getByRole('button', { name: 'Ajouter au plan' })).toBeDisabled()
  await form.getByRole('textbox', { name: 'Action' }).fill('Revoir le mix des familles avec le franchisé')
  await form.getByRole('combobox', { name: 'Qui' }).click()
  await page.getByRole('option', { name: 'Coach' }).click()
  await form.getByLabel('Pour le').fill(`${N + 1}-01-31`)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await form.getByRole('button', { name: 'Ajouter au plan' }).click()

  const enCours = plan.getByRole('list', { name: 'Actions en cours' }).getByRole('listitem')
  await expect(enCours).toHaveCount(1)
  await expect(enCours.first()).toContainText('Revoir le mix des familles avec le franchisé')
  await expect(enCours.first()).toContainText(`Marge en baisse · Coach · pour le 31/01/${N + 1}`)
  await expect(enCours.first()).toContainText(/Au départ : [-−]4,0 pt sur l’an dernier.*aujourd’hui : [-−]4,0 pt sur l’an dernier/)
  await expect(alertes.getByRole('listitem').filter({ hasText: 'Taux de marge' })).toContainText('Action en cours')
  const envoi = ecritures.find((e) => e.table === 'actions' && e.methode === 'POST')?.corps as Record<string, unknown>
  expect(envoi).toMatchObject({ store_name: MAGASINS[0], type_alerte: 'marge', responsable: 'coach', echeance: `${N + 1}-01-31`, annee: N, mois_depart: k })
  expect(envoi.depart as number).toBeCloseTo(-0.04, 9)
  await page.screenshot({ path: `captures/${info.project.name}-plan-action.png`, fullPage: true })

  await enCours.first().getByRole('button', { name: /^Retirer :/ }).click()
  await expect(plan).toContainText('Aucune action en cours.')
})

test('le franchisé voit l’action qui lui est confiée, la marque faite, sans rien créer ni retirer', async ({ page }) => {
  const ecritures = await seConnecter(page, { role: 'franchise', reel, actions: [action] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('region', { name: 'À faire' })).toContainText(`Plan d’action : Relancer la vente additionnelle en caisse, pour le 15/01/${N + 1}`)
  const plan = page.getByRole('region', { name: 'Plan d’action' })
  await expect(plan.getByRole('button', { name: 'Ajouter une action' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Agir :/ })).toHaveCount(0)
  await expect(plan.getByRole('button', { name: /^Retirer :/ })).toHaveCount(0)
  await expect(plan).toContainText(/Au départ : [-−]20,0\s%\sface au budget/)

  await plan.getByRole('button', { name: 'Faite : Relancer la vente additionnelle en caisse' }).click()
  await expect(plan).toContainText('Aucune action en cours.')
  expect(ecritures.find((e) => e.table === 'actions' && e.methode === 'PATCH')?.corps).toEqual({ statut: 'faite' })
  await plan.getByRole('button', { name: 'Actions closes (1)' }).click()
  await expect(plan.getByRole('list', { name: 'Actions closes' })).toContainText(/faite le/)
})

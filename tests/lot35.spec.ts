import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule, type PersonneSimulee } from './supabase-simule'

// Lot 35 (Joseph, 02/11/2026) : l'équipe redevient une étape du budget avec des changements datés ; frais du budget
// ligne par ligne (même montant, hausse en %, nouveau montant) ; frais de l'année en un seul tableau par thème.
// Données fictives uniquement : dépôt public.
const magasins: MagasinSimule[] = [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }]
const loyer: FraisSimule = { store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null }
const equipe: PersonneSimulee[] = [
  { id: 1, store_name: MAGASINS[0], poste: 'Responsable', categorie: 'cadre', heures_hebdo: 35, brut_mensuel: 6_000, primes: [], entree: null, sortie: null },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('équipe du budget : une hausse de salaire datée s’ajoute depuis les changements de l’année', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins, frais: [loyer], equipe })
  await ouvrir(page, 'Équipe')
  const changements = page.getByRole('region', { name: /^Changements prévus en \d{4}$/ })
  await expect(changements).toContainText('Aucun changement prévu')
  await changements.getByRole('button', { name: 'Ajouter un changement' }).click()
  await page.getByRole('menuitem', { name: 'Hausse de salaire d’un poste…' }).click()
  await page.getByRole('menuitem', { name: 'Responsable' }).click()
  await page.getByLabel('Hausse 1 en %').fill('5')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Enregistrer le poste' }).click()
  await expect(page.getByText('Responsable enregistré dans l’équipe.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'equipe' && e.methode === 'PATCH')?.corps as { hausses: unknown }
  const annee = Number((await changements.getAttribute('aria-label'))!.slice(-4))
  expect(envoi.hausses).toEqual([{ mois: `${annee}-01`, taux: 0.05 }])
  // Cadre à 6 000 € : au-dessus de 3 SMIC, pas de réduction ; 5 % × 72 000 € × 1,365 = 4 914 €
  await expect(changements.getByRole('row', { name: /Responsable : hausse de 5,0\s%/ })).toContainText(/\+4\s914\s€/)
  await page.screenshot({ path: `captures/${info.project.name}-equipe-changements.png`, fullPage: true })
})

test('frais du budget : nouveau montant sur une ligne, ligne ajoutée, enregistrés dans les ajustements', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins, frais: [loyer] })
  await ouvrir(page, 'Frais du budget')
  const immobilier = page.getByRole('rowgroup', { name: 'Immobilier' })
  await expect(immobilier.getByRole('row', { name: /^Locations immobilières/ })).toContainText(/60\s000\s€/)
  await immobilier.getByRole('group', { name: /^Choix \d{4} : Locations immobilières$/ }).getByRole('button', { name: 'Montant' }).click()
  await page.getByLabel(/^Montant \d{4} : Locations immobilières$/).fill('66 000')
  await page.getByRole('button', { name: /^Ajouter une ligne au budget : Communication$/ }).click()
  await page.getByRole('menuitem', { name: 'Budget communication annuel' }).click()
  await page.getByLabel(/^Montant \d{4} : Budget communication annuel$/).fill('2 400')
  await expect(page.getByRole('rowgroup', { name: 'Totaux' })).toContainText(/60\s000\s€.*68\s400\s€/)   // 66 000 + 2 400
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-frais-budget.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText(/^Ajustements enregistrés/)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: { fraisBudget: unknown } }
  expect(envoi.ajustements.fraisBudget).toEqual({ loyer: { mode: 'montant', valeur: 66_000 }, budget_communication: { mode: 'montant', valeur: 2_400 } })
})

test('frais de l’année : un seul tableau, un groupe repliable par thème', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins, frais: [loyer] })
  await ouvrir(page, 'Frais')
  const immobilier = page.getByRole('rowgroup', { name: 'Immobilier' })
  await expect(immobilier).toContainText(/60\s000\s€/)
  await immobilier.getByRole('button', { name: 'Immobilier : replier' }).click()
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveCount(0)
  await expect(immobilier).toContainText(/60\s000\s€/)
})

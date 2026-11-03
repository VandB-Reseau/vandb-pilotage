import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Investissements & Financements (Joseph, 03/11/2026) : travaux, achats amortis, emprunts, apport, emprunts en cours,
// capacité d'autofinancement ; le résultat et la trésorerie à l'étape « Visualiser ». Données fictives : dépôt public.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0)
// Magasin fictif : 24 000 € d'amortissements, 1 200 € d'intérêts et 30 000 € de capital par an sur ses emprunts en cours
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements: {}, ajustements_siege: {} }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé prévoit un achat, un emprunt et la fin d’un prêt en cours ; la CAF et la trésorerie suivent', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [propose] })
  await ouvrir(page, 'Investissements')
  const questions = page.getByRole('region', { name: 'Questions : travaux ou fermeture, achats d’équipement, emprunt ou apport' })
  await expect(questions.getByText('À répondre', { exact: true })).toHaveCount(3)
  await questions.getByRole('button', { name: 'Rien de prévu : travaux ou fermeture' }).click()

  // Une tireuse de 12 000 € en juillet sur 5 ans : 2 400 € par an, 6 mois sur 12 en 2027, soit 1 200 € de dotation
  await page.getByRole('button', { name: 'Ajouter un achat' }).click()
  const achats = page.getByRole('region', { name: 'Achats d’équipement', exact: true })
  await achats.getByLabel('Nom de l’achat 1').fill('Tireuse')
  await achats.getByLabel('Montant HT : Tireuse').fill('12 000')
  await achats.getByLabel('Mis en service en : Tireuse').selectOption('7')
  await expect(achats).toContainText(/12\sk€ HT · Dotation \d{4} : 1,2\sk€/)
  await expect(questions).toContainText('Oui, 1 achat prévu')

  // Un prêt de 60 000 € à 4 % sur 7 ans, 1re échéance en août : 820,13 € par mois, 979 € d'intérêts et 3 121 € de capital
  // d'août à décembre (tests/moteur/financement.spec.ts)
  await page.getByRole('button', { name: 'Ajouter un emprunt' }).click()
  const fin = page.getByRole('region', { name: 'Financements', exact: true })
  await fin.getByLabel('Nom de l’emprunt 1').fill('Banque')
  await fin.getByLabel('Montant emprunté : Banque').fill('60 000')
  await fin.getByLabel('Première échéance : Banque').selectOption('8')
  const pret = fin.getByRole('row').filter({ has: page.getByLabel('Nom de l’emprunt 1') })
  await expect(pret).toContainText(/820\s€ \/ mois/)
  await expect(pret).toContainText(/979\s€/)
  await expect(pret).toContainText(/3\s121\s€/)
  // Les emprunts en cours s'arrêtent fin juin : 600 € d'intérêts et 15 000 € de capital
  const enCours = fin.getByRole('row').filter({ hasText: 'Emprunts en cours' })
  await fin.getByLabel('Dernier mois des emprunts en cours').selectOption('6')
  await expect(enCours).toContainText(/600\s€/)
  await expect(enCours).toContainText(/15\s000\s€/)
  const caf = page.getByRole('region', { name: `Capacité d’autofinancement ${B}` })
  await expect(caf).toContainText('Échéances ÷ CAF')
  await expect(caf).toContainText('Investissements autofinancés')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-investissements.png`, fullPage: true })

  // Construire : la carte du thème résume la CAF
  await page.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  const carte = page.getByRole('region', { name: 'Investissements & Financements', exact: true })
  await expect(carte).toContainText('Capacité d’autofinancement')
  await expect(carte).toContainText('Échéances ÷ CAF')

  // Visualiser : intérêts et dotations au compte de résultat, l'emprunt encaissé en juillet dans la trésorerie
  await ouvrir(page, 'Visualiser')
  const compte = page.getByRole('table', { name: `Budget ${B} mois par mois` })
  // 24 000 € d'amortissements en cours + 1 200 € de la tireuse
  await expect(compte.getByRole('row', { name: /^Dotations aux amortissements/ })).toContainText(/[-−]25\s200\s€/)
  // 600 € des emprunts en cours + 979 € du nouveau prêt
  await expect(compte.getByRole('row', { name: /^Intérêts/ })).toContainText(/[-−]1\s579\s€/)
  await expect(page.locator('main').getByRole('region', { name: `Capacité d’autofinancement ${B}` }).filter({ visible: true })).toBeVisible()
  const treso = page.getByRole('region', { name: `Trésorerie ${B}` })
  const detail = treso.getByRole('button', { name: 'Voir le détail mois par mois' })
  if (await detail.count()) await detail.click()
  const encaisse = treso.getByRole('table', { name: `Trésorerie ${B} mois par mois` }).getByRole('row').filter({ hasText: 'Nouveaux emprunts et apport' })
  await expect(encaisse).toContainText(/60\s000/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés.', { exact: false })).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements).toEqual({
    rienPrevu: ['travaux'],
    investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 12_000, mois: 7, duree: 5 }],
    emprunts: [{ libelle: 'Banque', montant: 60_000, taux: 0.04, duree: 7, premiereEcheance: 8 }],
    finEmpruntsEnCours: 6,
  })
})

test('un Coach lit les investissements sans pouvoir les changer', async ({ page }) => {
  await seConnecter(page, {
    role: 'coach',
    magasins: [{ ...propose, ajustements: { investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 12_000, mois: 7, duree: 5 }] } }],
  })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Investissements')
  await expect(page.getByLabel('Montant HT : Tireuse')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ajouter un achat' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajouter un emprunt' })).toHaveCount(0)
})

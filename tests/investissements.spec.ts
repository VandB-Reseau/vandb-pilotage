import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Investissements & Financements (Joseph, 03/11/2026) : travaux, achats amortis, prêts du magasin, apport, emprunts en cours,
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

  // Sans prêt saisi, les emprunts en cours viennent des frais ; ils s'arrêtent fin juin : 600 € d'intérêts et 15 000 € de capital
  const fin = page.getByRole('region', { name: 'Financements', exact: true })
  const enCours = fin.getByRole('row').filter({ hasText: 'Emprunts en cours' })
  await fin.getByLabel('Dernier mois des emprunts en cours').selectOption('6')
  await expect(enCours).toContainText(/600\s€/)
  await expect(enCours).toContainText(/15\s000\s€/)

  // Joseph (03/11/2026) : un prêt de 60 000 € à 4 % sur 7 ans, 1re échéance en août, saisi dans les prêts du magasin :
  // 820,13 € par mois, 979 € d'intérêts et 3 121 € de capital d'août à décembre (tests/moteur/prets.spec.ts)
  await expect(page.getByRole('button', { name: 'Ajouter un emprunt' })).toHaveCount(0)
  await fin.getByRole('button', { name: 'Ajouter un prêt' }).click()
  await fin.getByLabel('Nom du prêt').fill('Banque')
  await fin.getByLabel('Montant emprunté', { exact: true }).fill('60 000')
  await fin.getByLabel('Mois de la 1re échéance').selectOption('8')
  await fin.getByLabel('Année de la 1re échéance').selectOption(String(B))
  await expect(fin).toContainText(/820,13\s€ par mois, dernière échéance en juillet \d{4}/)
  await fin.getByRole('button', { name: 'Enregistrer le prêt' }).click()
  await expect(fin.getByText('Banque enregistré.')).toBeVisible()
  const pret = fin.getByRole('row').filter({ hasText: 'Banque' })
  await expect(pret).toContainText(/820,13\s€/)
  await expect(pret).toContainText(/979\s€/)
  await expect(pret).toContainText(/3\s121\s€/)
  expect(ecritures.find((e) => e.table === 'emprunts' && e.methode === 'POST')?.corps).toEqual({
    store_name: MAGASINS[0], libelle: 'Banque', mode: 'initial', montant: 60_000, taux: 0.04, duree: 7, debut: `${B}-08-01`, differe: 0, mensualite: null,
  })
  // Le prêt saisi remplace les emprunts en cours des frais ; l'achat en cours de saisie est gardé
  await expect(enCours).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Achats d’équipement', exact: true }).getByLabel('Montant HT : Tireuse')).toHaveValue(/12\s000/)
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

  // Visualiser : intérêts et dotations au compte de résultat ; le prêt saisi est déjà dépensé, rien n'entre en trésorerie
  await ouvrir(page, 'Visualiser')
  const compte = page.getByRole('table', { name: `Budget ${B} mois par mois` })
  // 24 000 € d'amortissements en cours + 1 200 € de la tireuse
  await expect(compte.getByRole('row', { name: /^Dotations aux amortissements/ })).toContainText(/[-−]25\s200\s€/)
  // Les intérêts du prêt seuls : ceux des frais (emprunts en cours) sont remplacés par les prêts du magasin
  await expect(compte.getByRole('row', { name: /^Intérêts/ })).toContainText(/[-−]979\s€/)
  await expect(page.locator('main').getByRole('region', { name: `Capacité d’autofinancement ${B}` }).filter({ visible: true })).toBeVisible()
  const treso = page.getByRole('region', { name: `Trésorerie ${B}` })
  const detail = treso.getByRole('button', { name: 'Voir le détail mois par mois' })
  if (await detail.count()) await detail.click()
  const encaisse = treso.getByRole('table', { name: `Trésorerie ${B} mois par mois` }).getByRole('row').filter({ hasText: 'Nouveaux emprunts et apport' })
  await expect(encaisse).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés.', { exact: false })).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements).toEqual({
    rienPrevu: ['travaux'],
    investissements: [{ libelle: 'Tireuse', type: 'equipement', montant: 12_000, mois: 7, duree: 5 }],
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

import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Budget complet : démarque par famille, saisonnalité du magasin, travaux, copie d'un magasin à l'autre.
// Données fictives uniquement : dépôt public. Sans cible, le magasin fictif fait 600 000 € de CA
// (Bière 200 000 à 36 %, Fût 300 000 à 74 %, Événements 100 000 à 40 %), 7,5 % du CA par mois de janvier à août.

const travaux = { activite: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0, investissement: 30_000, dureeAmortissement: 5 }
const magasins = (): MagasinSimule[] => [
  { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null },
  { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: { travaux }, maj_le: null },
  { magasin: MAGASINS[2], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé ajoute démarque, saisonnalité et travaux, puis enregistre', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: magasins().slice(0, 1) })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const grille = page.getByRole('table', { name: 'Hypothèses du magasin' })
  const biere = grille.getByRole('row', { name: /Bière \(Cave\)/ })

  // Démarque : 200 000 × (36 % − 2 %) = 68 000
  await page.getByLabel('Démarque par famille : Bière (Cave)').fill('2')
  await expect(biere).toContainText(/68\sk€/)

  // Saisonnalité : janvier à 10 %, le total dépasse 100 % et bloque l'enregistrement
  const saison = page.getByRole('region', { name: 'Saisonnalité' })
  await page.getByLabel('Part du CA en Janv.').fill('10')
  await expect(saison).toContainText(/102,5\s%/)
  await expect(page.getByRole('button', { name: 'Enregistrer les ajustements' })).toBeDisabled()
  await page.getByLabel('Part du CA en Févr.').fill('5')
  await expect(page.getByRole('button', { name: 'Enregistrer les ajustements' })).toBeEnabled()
  const caMois = saison.getByRole('row', { name: /CA du mois/ })
  await expect(caMois).toContainText(/60\s000.*30\s000.*45\s000/)   // 600 000 × 10 %, 5 %, 7,5 %

  // Travaux : mars fermé (− 45 000 €), 60 000 € sur 5 ans amortis sur les 9 mois suivants (9 000 €)
  await page.getByRole('button', { name: 'Prévoir des travaux' }).click()
  await page.getByLabel('Activité en Mars').fill('0')
  await page.getByLabel('Investissement HT').fill('60000')
  const chantier = page.getByRole('region', { name: 'Travaux' })
  await expect(chantier).toContainText(/CA de l’année : [-−]45\s000\s€/)
  await expect(chantier).toContainText(/Dotation : 9\sk€/)
  await expect(page.getByRole('table', { name: 'Budget 2027 mois par mois' }).getByRole('row', { name: /^Dotations aux amortissements/ })).toContainText(/[-−]33\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-budget-complet.png`, fullPage: true })

  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés : le budget est en discussion avec le siège.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements.demarqueFamille).toEqual({ 'cave/Bière': 0.02 })
  expect((envoi.ajustements.poidsMois as number[]).slice(0, 3)).toEqual([0.1, 0.05, 0.075])
  expect(envoi.ajustements.travaux).toEqual({ activite: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0, investissement: 60_000, dureeAmortissement: 5 })
})

test('le Directeur copie les hypothèses vers un autre magasin, ses travaux restent', async ({ page }) => {
  const liste = magasins()
  liste[0].ajustements = { evolutionFamille: { 'cave/Bière': 0.05 }, travaux: { ...travaux, investissement: 99_000 } }
  const ecritures = await seConnecter(page, { magasins: liste })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await page.getByRole('button', { name: 'Copier vers d’autres magasins' }).click()
  const panneau = page.getByRole('region', { name: `Copier les hypothèses de ${MAGASINS[0]}` })
  // Le budget validé n'est pas proposé
  await expect(panneau.getByRole('checkbox')).toHaveCount(2)
  await panneau.getByLabel(MAGASINS[1]).check()
  await panneau.getByRole('button', { name: 'Copier' }).click()
  await expect(page.getByText(`Hypothèses copiées vers ${MAGASINS[1]}.`)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')
  expect(envoi?.filtre).toContain(encodeURIComponent(MAGASINS[1]))
  expect((envoi?.corps as { ajustements: unknown }).ajustements).toEqual({ evolutionFamille: { 'cave/Bière': 0.05 }, travaux })
})

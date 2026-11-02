import { expect, test } from '@playwright/test'
import { MAGASINS, magasinFictif } from './donnees-fictives'
import { allerVers, COMPTE, ongletParametres, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 39 : paramètres réseau en onglets, redevance et impôts modifiables, journal, copie d'une année sur l'autre,
// contrôle de gestion. Magasin fictif (tests/donnees-fictives.ts) : 640 000 € de CA. Données fictives : dépôt public.

const maintenant = new Date()
const aB = maintenant.getFullYear() + (maintenant.getMonth() >= 8 ? 1 : 0) // année budgétée, comme anneeBudget()
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
const valide: MagasinSimule = { ...propose, magasin: MAGASINS[1], statut: 'valide' }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur change la redevance : effet sur les budgets non validés, puis trace dans le journal', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: [propose, valide] })
  await allerVers(page, 'Paramètres réseau')
  await expect(page.getByRole('tablist', { name: 'Rubriques des paramètres' }).getByRole('tab'))
    .toHaveText(['Franchise et impôts', 'Équipe', 'Trésorerie', 'Alertes et campagne', 'Journal', 'Accès'])
  const section = page.getByRole('region', { name: 'Franchise et impôts' })
  const enregistrer = section.getByRole('button', { name: 'Enregistrer' })
  await expect(page.getByLabel('Redevance franchise')).toHaveValue('2')
  await expect(enregistrer).toBeDisabled()

  // Hors bornes : refusé
  await page.getByLabel('Redevance franchise').fill('12')
  await expect(section.getByText('Redevance et publicité : entre 0 et 10 % du CA')).toBeVisible()
  await expect(enregistrer).toBeDisabled()

  // 2 % → 2,5 % : 0,5 % des 600 000 € de CA budgété = 3 000 € de moins sur l'EBE du seul budget non validé
  await page.getByLabel('Redevance franchise').fill('2,5')
  const effet = page.getByRole('status', { name: 'Effet sur les budgets' })
  await expect(effet).toContainText(`EBE du budget ${aB} pas encore validé`)
  await expect(effet).toContainText(/\([-−]3\s000\s€\)/)
  // Une saisie en cours bloque le changement d'année et la copie
  await expect(page.getByRole('group', { name: 'Année des paramètres' }).getByRole('button').first()).toBeDisabled()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot39-franchise.png`, fullPage: true })
  await enregistrer.click()
  await expect(page.getByText(`Franchise et impôts ${aB} enregistrés.`)).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { annee: number; valeur: { tauxRedevance: number } }
  expect(ecrite.annee).toBe(aB)
  expect(ecrite.valeur.tauxRedevance).toBe(0.025)

  await ongletParametres(page, 'Journal')
  const journal = page.getByRole('table', { name: `Journal des paramètres ${aB}` })
  const ligne = journal.getByRole('row', { name: /Redevance franchise/ })
  await expect(ligne).toContainText('2,0 % → 2,5 %')
  await expect(ligne).toContainText(COMPTE.email)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot39-journal.png`, fullPage: true })
})

test('copier les paramètres vers l’année suivante, sans les dates de campagne', async ({ page }) => {
  const ecritures = await seConnecter(page, {
    parametres: { tauxRedevance: 0.022, tauxPublicite: 0.01, campagne: { proposition: '2020-01-01', retour: '2020-01-02', validation: '2020-01-03' } },
    parametresAnnees: { [aB + 1]: { tauxRedevance: 0.03 } },
  })
  await allerVers(page, 'Paramètres réseau')
  await page.getByRole('button', { name: `Copier vers ${aB + 1}` }).click()
  const dialogue = page.getByRole('dialog', { name: `Copier les paramètres ${aB} vers ${aB + 1} ?` })
  await expect(dialogue).toContainText(`Les paramètres ${aB + 1} déjà enregistrés seront remplacés.`)
  await dialogue.getByRole('button', { name: 'Copier' }).click()
  await expect(page.getByText(`Paramètres ${aB} copiés vers ${aB + 1}.`)).toBeVisible()
  const copie = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { annee: number; valeur: Record<string, unknown> }
  expect(copie.annee).toBe(aB + 1)
  expect(copie.valeur.tauxRedevance).toBe(0.022)
  expect(copie.valeur.campagne).toBeUndefined()
  // L'écran passe sur l'année copiée
  await expect(page.getByRole('group', { name: 'Année des paramètres' }).getByRole('button', { name: String(aB + 1) })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Redevance franchise')).toHaveValue('2,2')
})

test('le Directeur désigne et retire un compte du contrôle de gestion', async ({ page, isMobile }) => {
  await seConnecter(page, { comptesConnus: ['controle@exemple.fr'] })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Accès')
  const section = page.getByRole('region', { name: 'Contrôle de gestion' })
  await expect(section).toContainText('Aucun compte pour l’instant')
  await section.getByLabel('Email du compte à ajouter').fill('inconnu@exemple.fr')
  await section.getByRole('button', { name: 'Ajouter' }).click()
  await expect(section.getByText(/Aucun compte avec cet email/)).toBeVisible()
  await section.getByLabel('Email du compte à ajouter').fill('Controle@Exemple.fr')
  await section.getByRole('button', { name: 'Ajouter' }).click()
  await expect(section.getByText('controle@exemple.fr peut maintenant modifier les paramètres réseau.')).toBeVisible()
  await expect(section.getByRole('table', { name: 'Comptes du contrôle de gestion' })).toContainText('controle@exemple.fr')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.getByRole('button', { name: 'Retirer controle@exemple.fr' }).click()
  await expect(section.getByText('controle@exemple.fr ne modifie plus les paramètres réseau.')).toBeVisible()
  await expect(section.getByRole('table', { name: 'Comptes du contrôle de gestion' })).toHaveCount(0)
})

test('le contrôle de gestion, sans rôle dans l’app réseau, n’a que les paramètres et les modifie', async ({ page }) => {
  const ecritures = await seConnecter(page, { role: 'aucun', parametreur: true, magasins: [] })
  await expect(page.getByRole('heading', { level: 1, name: 'Paramètres réseau' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Accès' })).toHaveCount(0)
  await page.getByLabel('Impôt : taux normal').fill('26')
  await page.getByRole('region', { name: 'Franchise et impôts' }).getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Franchise et impôts \d{4} enregistrés\./)).toBeVisible()
  expect((ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { impot: { tauxNormal: number } } }).valeur.impot.tauxNormal).toBe(0.26)
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await expect(page.getByRole('menu')).toContainText('Contrôle de gestion')
})

test('un Responsable Régional consulte les paramètres et le journal, sans rien modifier', async ({ page, isMobile }) => {
  await seConnecter(page, {
    role: 'rr', magasins: [propose],
    journal: [{ id: 1, annee: aB, rubrique: 'impot', avant: { tauxNormal: 0.25 }, apres: { tauxNormal: 0.26 }, par_email: 'directeur@exemple.fr', le: `${aB - 1}-11-02T10:00:00Z` }],
  })
  await allerVers(page, 'Paramètres réseau')
  await expect(page.getByText('Consultation seule')).toBeVisible()
  await expect(page.getByLabel('Redevance franchise')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Copier vers/ })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Accès' })).toHaveCount(0)
  await ongletParametres(page, 'Journal')
  await expect(page.getByRole('row', { name: /Impôt sur les sociétés/ })).toContainText('taux normal : 25,0 % → 26,0 %')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule, type PretSimule } from './supabase-simule'

// Prêts du magasin (Joseph, 03/11/2026) : saisis une fois avec leur date, ils donnent les intérêts et le capital de chaque
// année ; les lignes des frais en sont tirées. Un prêt saisi est déjà dépensé : il n'apporte pas de trésorerie.
// Données fictives : dépôt public.

const N = new Date().getFullYear()
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements: {}, ajustements_siege: {} }
const loyer: FraisSimule = { store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null }
const interetsFrais: FraisSimule = { store_name: MAGASINS[0], code: 'interets', libelle: 'Intérêts sur emprunts', rubrique: 'finances', annuel: 5_000, taux_ca: null }
// 30 000 € restant dus, 600 € par mois à 4 %, depuis janvier : sur l'année, 1 088,77 € d'intérêts et 6 111,23 € de capital
// (tests/moteur/prets.spec.ts)
const creation: PretSimule = { id: 1, store_name: MAGASINS[0], libelle: 'Prêt de création', mode: 'restant', montant: 30_000, taux: 0.04, duree: null, debut: `${N}-01-01`, differe: 0, mensualite: 600 }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('frais de l’année : intérêts et capital calculés depuis les prêts, sans saisie', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose], frais: [loyer, interetsFrais], prets: [creation] })
  await ouvrir(page, 'Frais')
  const interets = page.getByRole('row').filter({ hasText: 'Intérêts sur emprunts' })
  await expect(interets).toContainText('Calculé depuis les prêts du magasin')
  await expect(interets).toContainText(/1\s089\s€/)
  await expect(page.getByLabel('Intérêts sur emprunts', { exact: true })).toHaveCount(0)
  const capital = page.getByRole('row').filter({ hasText: 'Capital d’emprunts remboursé' })
  await expect(capital).toContainText(/6\s111\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-prets-frais.png`, fullPage: true })
})

test('le franchisé modifie puis retire un prêt ; sans prêt, les frais reprennent la main', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [propose], frais: [loyer, interetsFrais], prets: [creation] })
  await ouvrir(page, 'Investissements')
  const fin = page.getByRole('region', { name: 'Financements', exact: true })
  const ligne = fin.getByRole('row').filter({ hasText: 'Prêt de création' })
  await expect(ligne).toContainText(/600,00\s€/)
  await expect(ligne).toContainText('Saisi par son capital restant dû')
  // Les emprunts en cours des frais ne s'affichent plus : le prêt les remplace
  await expect(fin.getByRole('row').filter({ hasText: 'Emprunts en cours' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-prets.png`, fullPage: true })

  // Mensualité passée à 650 € : enregistrée aussitôt
  await fin.getByRole('button', { name: 'Modifier Prêt de création' }).click()
  await expect(fin.getByLabel('Capital restant dû', { exact: true })).toHaveValue(/30\s000/)
  await fin.getByLabel('Mensualité', { exact: true }).fill('650')
  await fin.getByRole('button', { name: 'Enregistrer le prêt' }).click()
  await expect(fin.getByText('Prêt de création enregistré.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'emprunts' && e.methode === 'PATCH')?.corps).toMatchObject({ mode: 'restant', montant: 30_000, mensualite: 650, duree: null, debut: `${N}-01-01` })
  await expect(ligne).toContainText(/650,00\s€/)

  // Une mensualité sous les intérêts du mois est refusée, en clair
  await fin.getByRole('button', { name: 'Modifier Prêt de création' }).click()
  await fin.getByLabel('Mensualité', { exact: true }).fill('50')
  await fin.getByRole('button', { name: 'Enregistrer le prêt' }).click()
  await expect(fin.getByRole('alert')).toContainText('La mensualité doit couvrir plus que les intérêts du mois')
  await fin.getByRole('button', { name: 'Fermer sans enregistrer' }).click()

  // Retiré : les emprunts en cours repris des frais reviennent
  await fin.getByRole('button', { name: 'Retirer Prêt de création' }).click()
  await fin.getByRole('button', { name: 'Retirer Prêt de création' }).click()
  await expect(fin.getByText('Prêt de création retiré.')).toBeVisible()
  expect(ecritures.some((e) => e.table === 'emprunts' && e.methode === 'DELETE')).toBe(true)
  await expect(fin.getByRole('row').filter({ hasText: 'Emprunts en cours' })).toBeVisible()
})

test('frais du budget : les lignes des prêts ne se choisissent pas', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose], frais: [loyer, interetsFrais], prets: [creation] })
  await ouvrir(page, 'Frais du budget')
  const interets = page.getByRole('row').filter({ hasText: 'Intérêts et charges assimilées' }).filter({ hasText: 'Calculé depuis les prêts' })
  await expect(interets).toHaveCount(1)
  await expect(page.getByRole('group', { name: /^Choix \d{4} : Intérêts et charges assimilées$/ })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /^Choix \d{4} : Capital d’emprunts remboursé$/ })).toHaveCount(0)
})

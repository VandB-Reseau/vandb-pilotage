import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Construire le budget : cibles du réseau et des groupes, ajustements du magasin, validation.
// Données fictives uniquement (magasin fictif) : dépôt public.

const reseau = { evolutionUnivers: { cave: 0.03, bar: 0.03, exterieur: 0 }, hausseSalaires: 0.02, inflationFrais: 0.02, margeFamille: { 'bar/Fût': 0.75 } }
const avecBase = (statut: MagasinSimule['statut'] = 'propose'): MagasinSimule[] => [
  { magasin: MAGASINS[0], statut, hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur fixe les cibles du réseau et voit leur effet sur le total', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: avecBase() })
  await page.getByRole('link', { name: /Hypothèses/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hypothèses' })).toBeVisible()
  // Sans cible : CA = atterrissage du magasin fictif, 600 000
  const effet = page.getByRole('region', { name: 'Effet des hypothèses' })
  await expect(effet).toContainText(/600\sk€/)
  await page.getByLabel('Évolution du CA par univers : Cave').fill('5')
  // 200 000 × 1,05 + 300 000 + 100 000
  await expect(effet).toContainText(/610\sk€/)
  await page.getByLabel('Salaires et frais : Hausse des salaires').fill('2,5')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Cibles enregistrées.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'cibles_reseau')?.corps).toEqual({ annee: 2027, valeur: { evolutionUnivers: { cave: 0.05 }, hausseSalaires: 0.025 } })
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-hypotheses.png`, fullPage: true })
})

test('le Directeur crée un groupe, y range un magasin et lui donne ses propres cibles', async ({ page }) => {
  const ecritures = await seConnecter(page, { magasins: avecBase(), reseau })
  await page.getByRole('link', { name: /Hypothèses/ }).click()
  await page.getByRole('button', { name: 'Groupe' }).click()
  await page.getByLabel('Nom du groupe').fill('Centre-ville')
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('tab', { name: 'Centre-ville' })).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('Magasins du groupe Centre-ville').click()
  await page.getByRole('option', { name: MAGASINS[0] }).click()
  await expect(page.getByText('Magasins du groupe enregistrés.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'groupe_magasins')?.corps).toEqual({ store_name: MAGASINS[0], groupe_id: 1 })
  // La cible du réseau s'affiche en grisé ; le groupe la remplace pour le Bar
  await expect(page.getByLabel('Évolution du CA par univers : Bar')).toHaveAttribute('placeholder', '3')
  await page.getByLabel('Évolution du CA par univers : Bar').fill('8')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Cibles enregistrées.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'cibles_groupe')?.corps).toEqual({ groupe_id: 1, annee: 2027, valeur: { evolutionUnivers: { bar: 0.08 } } })
  // 200 000 × 1,03 + 300 000 × 1,08 + 100 000
  await expect(page.getByRole('region', { name: 'Effet des hypothèses' })).toContainText(/630\sk€/)
})

test('le franchisé s’écarte d’une cible : le budget passe en discussion, il ne valide pas', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: avecBase(), reseau })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const resultat = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  // Cibles du réseau : 200 000 × 1,03 + 300 000 × 1,03 + 100 000
  await expect(resultat.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/615\s000\s€/)
  await expect(page.getByText('aucun écart aux cibles du siège', { exact: false })).toBeVisible()
  const hypotheses = page.getByRole('table', { name: 'Hypothèses du magasin' })
  await expect(hypotheses.getByRole('row', { name: /Bière \(Cave\)/ }).first()).toContainText('Réseau')
  await page.getByLabel('Évolution du CA par famille : Bière (Cave)').fill('5')
  await expect(resultat.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/619\s000\s€/)
  await expect(page.getByText('1 écart aux cibles du siège', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Valider le budget' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-hypotheses.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés : le budget est en discussion avec le siège.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: unknown }
  expect(envoi.ajustements).toEqual({ evolutionFamille: { 'cave/Bière': 0.05 } })
  await expect(page.getByText('En discussion', { exact: true })).toBeVisible()
  // Revenir à la cible du réseau
  await page.getByRole('button', { name: 'Reprendre la valeur du niveau au-dessus : Bière (Cave)' }).click()
  await expect(resultat.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/615\s000\s€/)
})

test('le Directeur valide le budget, puis peut le rouvrir', async ({ page }) => {
  const ecritures = await seConnecter(page, { magasins: avecBase('en_discussion'), reseau })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await page.getByRole('button', { name: 'Valider le budget' }).click()
  await expect(page.getByText('Budget 2027 validé.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { statut: string; hypotheses: { familles: { evolution: number }[] } }
  expect(envoi.statut).toBe('valide')
  // Les hypothèses figées sont celles des cibles du moment
  expect(envoi.hypotheses.familles.map((f) => f.evolution)).toEqual([0.03, 0.03, 0])
  await expect(page.getByLabel('Évolution du CA par famille : Bière (Cave)')).toBeDisabled()
  await page.getByRole('button', { name: 'Rouvrir la discussion' }).click()
  await expect(page.getByText('Budget rouvert : il est de nouveau en discussion.')).toBeVisible()
})

test('un Coach lit les hypothèses sans pouvoir les modifier ; une écriture qui échoue l’explique', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: avecBase(), reseau })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByLabel('Évolution du CA par famille : Bière (Cave)')).toBeDisabled()
  await expect(page.getByRole('button', { name: /Enregistrer|Valider|Importer/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Hypothèses/ })).toHaveCount(0)

  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.getByRole('button', { name: 'Mon compte' }).click()
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click()
  await seConnecter(page, { role: 'franchise', magasins: avecBase(), reseau, panneEcriture: true })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await page.getByLabel('Salaires et frais : Hausse des salaires').fill('1')
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.')).toBeVisible()
})

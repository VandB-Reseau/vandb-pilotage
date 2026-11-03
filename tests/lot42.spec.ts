import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type QuadrimestreSimule } from './supabase-simule'

// Lot 42 (Joseph, 02/11/2026) : magasin dans la barre du haut, budget sur une page, équipe, frais et trésorerie de départ
// repris des comptes, « D'accord » par thème, validation en série. Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
// Base sans équipe ni frais : le budget part des comptes de l'année
const sansDetail = { ...magasinFictif, personnel: { ...magasinFictif.personnel, salairesMensuels: Array(12).fill(0), remunerationGerance: 0 }, frais: [] }
const q = (magasin: string, quadrimestre: number, s: Partial<QuadrimestreSimule>): QuadrimestreSimule =>
  ({ store_name: magasin, annee: N, quadrimestre, achats: null, variation_stock: null, charges_externes: null, impots_taxes: null, personnel: null, tresorerie: null, ...s })
// Janvier à août : 50 000 € de personnel, 30 000 € de charges externes, 4 000 € d'impôts et taxes par quadrimestre
const comptes = (magasin: string) => [
  q(magasin, 1, { personnel: 50_000, charges_externes: 30_000, impots_taxes: 4_000, tresorerie: 22_000 }),
  q(magasin, 2, { personnel: 50_000, charges_externes: 30_000, impots_taxes: 4_000, tresorerie: 30_000 }),
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('budget sans équipe ni frais saisis : repris des comptes de l’année, trésorerie de départ estimée', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: sansDetail, base: sansDetail, maj_le: null }], quadrimestres: comptes(MAGASINS[0]) })
  await ouvrir(page, 'Construire')
  const main = page.locator('main')
  // 100 000 € de personnel sur 8 mois : 12 500 € par mois, 150 k€ sur l'année
  const equipe = main.getByRole('region', { name: 'Équipe', exact: true })
  await expect(equipe).toContainText(`Comptes ${N} (8 mois)`)
  await expect(equipe).not.toContainText('à renseigner')
  await expect(equipe).toContainText('150 k€')
  await expect(main.getByRole('region', { name: 'Frais', exact: true })).toContainText(`Comptes ${N} (8 mois)`)
  // Trésorerie au 1er janvier : 30 000 € fin août, plus l'activité prévue jusqu'en décembre ; elle se lit sous le
  // résultat et se règle au point de départ (lot 43)
  await expect(main.getByLabel('Trésorerie de départ')).toContainText('estimée')
  await expect(main.getByText(/^Estimée à .* fin août/)).toBeVisible()
  // L'onglet de l'étape ne signale plus l'équipe à renseigner
  await expect(page.getByRole('navigation', { name: 'Pages du magasin' }).getByRole('tab', { name: /^1 · Construire/ })).not.toContainText('équipe')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot42-reprise.png`, fullPage: true })
})

test('budget sur une page : le résultat suit chaque changement ; « D’accord » par thème, enregistré avec les ajustements', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements_siege: {} }] })
  await ouvrir(page, 'Ventes')
  // Panneau Impact (03/11/2026) : il remplace la bande des indicateurs clés
  const resultat = page.getByRole('complementary', { name: 'Impact des changements' })
  if (isMobile) await resultat.getByRole('button', { name: 'Voir l’impact' }).click()
  await expect(resultat.locator('[data-impact="ebe"]')).toContainText('inchangé')
  // Hypothèses et résultat sur la même page : + 5 % de tickets Cave, l'EBE bouge sans changer de page
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  await expect(resultat.locator('[data-impact="ebe"]')).not.toContainText('inchangé')
  // Le thème changé le dit ; un autre thème s'accepte d'un clic
  await expect(page.getByLabel('Ventes et marge : changé par le magasin')).toBeVisible()
  // Les autres thèmes s'acceptent depuis leur carte, sur la page Construire
  await page.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  await expect(page.getByRole('table', { name: /mois par mois$/ })).toBeVisible()
  const calendrier = page.getByRole('button', { name: 'Calendrier : d’accord avec le siège' })
  await calendrier.click()
  await expect(calendrier).toHaveAttribute('aria-pressed', 'true')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot42-construire.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés.', { exact: false })).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements).toEqual({ evolutionFlux: { cave: 0.05 }, accords: ['calendrier'] })
})

test('le Responsable Régional valide en une fois les budgets envoyés sans changement ; la trésorerie estimée est figée', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, {
    role: 'rr',
    magasins: [
      { magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: sansDetail, base: sansDetail, maj_le: null, ajustements: { accords: ['ventes'] }, ajustements_siege: {}, envoye_le: `${N}-11-20T10:00:00Z` },
      { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, maj_le: null, ajustements: { evolutionFlux: { cave: 0.03 } }, ajustements_siege: {}, envoye_le: `${N}-11-20T10:00:00Z` },
      { magasin: MAGASINS[2], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, maj_le: null },
    ],
    quadrimestres: comptes(MAGASINS[0]),
  })
  // Lot 43 : « Valider en série » est un bouton du bandeau de la campagne
  await page.getByRole('region', { name: /^Campagne des budgets/ }).getByRole('button', { name: 'Valider en série · 1' }).click()
  const prets = page.getByRole('region', { name: 'Budgets prêts à valider' })
  await expect(prets).toContainText('1 budget prêt à valider')
  await expect(prets).toContainText(`Envoyés sans changement par rapport au siège : ${MAGASINS[0]}.`)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot42-prets.png`, fullPage: false })
  await prets.getByRole('button', { name: 'Valider ce budget' }).click()
  await expect(prets).toContainText(`1 budget ${N + 1} validé.`)
  const envoi = ecritures.filter((e) => e.table === 'budgets' && e.methode === 'PATCH')
  expect(envoi).toHaveLength(1)
  expect(envoi[0].filtre).toContain(encodeURIComponent(MAGASINS[0]))
  const corps = envoi[0].corps as { statut: string; hypotheses: { departEstime?: { depuis: number; quadrimestre: number } }; ajustements?: unknown }
  expect(corps.statut).toBe('valide')
  expect(corps.ajustements).toBeUndefined()           // le RR ne touche pas aux ajustements
  expect(corps.hypotheses.departEstime).toMatchObject({ depuis: 30_000, quadrimestre: 2 })
})

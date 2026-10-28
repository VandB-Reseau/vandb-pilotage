import { expect, test } from '@playwright/test'
import { calculerBudget } from '../src/moteur/budget'
import { parametresParDefaut } from '../src/moteur/parametres'
import { tresorerieBudget } from '../src/moteur/tresorerie'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Trésorerie du budget : section du budget, paramètres réseau, point bas dans la liste. Données fictives : dépôt public.
// Les montants attendus viennent du moteur, vérifié à la main dans tests/moteur/tresorerie.spec.ts.

const b = calculerBudget(magasinFictif, parametresParDefaut)
const attendu = (debut: number) => tresorerieBudget(b, magasinFictif, parametresParDefaut, parametresParDefaut.tresorerie, debut)
const k = (v: number) => new RegExp(`${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v / 1000).replace(/\s/g, '\\s').replace('-', '[-−]')}\\sk€`)
const magasin = (statut: MagasinSimule['statut'], ajustements = {}): MagasinSimule =>
  ({ magasin: MAGASINS[0], statut, hypotheses: magasinFictif, base: magasinFictif, ajustements, maj_le: null })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('budget : trésorerie mois par mois, le franchisé saisit sa trésorerie de départ', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin('propose')] })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  // Budget proposé, sans cible : 600 000 € de CA, 45 000 € en janvier (tests/budget-complet.spec.ts)
  const section = page.getByRole('region', { name: 'Trésorerie 2027' })
  const bref = section.getByLabel('Trésorerie en bref')
  const tableau = section.getByRole('table', { name: 'Trésorerie 2027 mois par mois' })
  const ligne = (nom: string) => tableau.getByRole('row').filter({ has: page.getByRole('cell', { name: nom, exact: true }) })
  await expect(ligne('Encaissements des ventes TTC')).toContainText(/^Encaissements des ventes TTC53\s550/)   // 45 000 × 1,19
  await expect(ligne('TVA reversée')).toBeVisible()
  await expect(ligne('Travaux')).toHaveCount(0)                       // pas de travaux : pas de ligne
  const finSans = await ligne('Trésorerie en fin de mois').getByRole('cell').last().textContent()
  const lire = (t: string | null) => Number((t ?? '').replace(/[\s\u202f\u00a0]/g, '').replace('−', '-'))

  // 20 000 € au départ : chaque fin de mois monte d'autant
  await page.getByLabel('Trésorerie au 1er janvier').fill('20000')
  await expect(bref).toContainText(/\+?[-−]?\d+\sk€ sur l’année/)
  await expect.poll(async () => lire(await ligne('Trésorerie en fin de mois').getByRole('cell').last().textContent()) - lire(finSans)).toBe(20_000)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await section.screenshot({ path: `captures/${info.project.name}-tresorerie.png` })

  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés : le budget est en discussion avec le siège.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements.tresorerieDepart).toBe(20_000)
})

test('budget validé : trésorerie en lecture seule, départ enregistré repris, point bas dans la liste', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'directeur', magasins: [magasin('valide', { tresorerieDepart: -50_000 })] })
  if (!isMobile) {
    const liste = page.getByRole('table', { name: 'Budgets 2027 par magasin' })
    await expect(liste.getByRole('columnheader', { name: 'Point bas de trésorerie' })).toBeVisible()
    await expect(liste.getByRole('row').nth(1)).toContainText(k(attendu(-50_000).pointBas.montant))
  }
  await page.getByText(MAGASINS[0], { exact: true }).first().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  await expect(page.getByLabel('Trésorerie au 1er janvier')).toBeDisabled()
  await expect(page.getByLabel('Trésorerie au 1er janvier')).toHaveValue(/[-−]50\s000/)
  await expect(page.getByLabel('Trésorerie en bref')).toContainText(`${attendu(-50_000).moisNegatifs} mois`)
})

test('paramètres réseau : le Directeur règle délais et TVA de la trésorerie', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { role: 'directeur' })
  await page.getByRole('link', { name: /Paramètres/ }).first().click()
  const section = page.getByRole('region', { name: 'Trésorerie' })
  const enregistrer = section.getByRole('button', { name: 'Enregistrer' })
  await expect(enregistrer).toBeDisabled()
  await page.getByLabel('Délai de paiement des fournisseurs').fill('2')
  await section.getByRole('button', { name: 'Chaque trimestre' }).click()
  await page.getByLabel('TVA moyenne sur les ventes').fill('18')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  // Un délai hors de 0 à 3 mois bloque l'enregistrement
  await page.getByLabel('Délai de paiement de la redevance').fill('6')
  await expect(enregistrer).toBeDisabled()
  await page.getByLabel('Délai de paiement de la redevance').fill('1')
  await enregistrer.click()
  await expect(page.getByText('Paramètres de trésorerie 2027 enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { tresorerie: Record<string, unknown> } }
  expect(envoi.valeur.tresorerie).toMatchObject({ delaiFournisseurs: 2, delaiRedevance: 1, tvaTrimestrielle: true, tvaVentes: 0.18 })
})

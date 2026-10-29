import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type TicketsSimules, type VenteSimulee, plusLoin } from './supabase-simule'

// Lot 28 : alertes tickets et panier, fiche de visite, leviers commerciaux, campagne des budgets, CA par heure,
// barre d'enregistrement des frais. Données fictives uniquement : dépôt public.
const N = new Date().getFullYear()
const k = Math.max(3, new Date().getMonth())     // au moins 3 mois réalisés pour les alertes commerciales
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
// Premier magasin : Cave à 900 tickets par mois contre 1 000 l'an dernier, panier 40 € ; Bar à 500 tickets, panier 15 € contre 16 €
const reel: VenteSimulee[] = Array.from({ length: k }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 30_000, ca_ttc: 36_000, marge_ht: 12_000 },
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'bar', famille: 'Fût', ca_ht: 6_250, ca_ttc: 7_500, marge_ht: 4_375 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 33_333, ca_ttc: 40_000, marge_ht: 13_333 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'bar', famille: 'Fût', ca_ht: 6_667, ca_ttc: 8_000, marge_ht: 4_667 },
] as VenteSimulee[]).flat()
const tickets: TicketsSimules[] = Array.from({ length: k }, (_, i) => [
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', tickets: 900 },
  { store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'bar', tickets: 500 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'cave', tickets: 1_000 },
  { store_name: MAGASINS[0], mois: mois(N - 1, i + 1), univers: 'bar', tickets: 500 },
]).flat()

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('alertes tickets et panier, Cave et Bar séparés ; « Agir » pré-remplit l’action', async ({ page, isMobile }) => {
  await seConnecter(page, { reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const alertes = page.getByRole('region', { name: 'Alertes' })
  // 2 700 tickets contre 3 000 sur les 3 derniers mois : −10 % ; panier 15 € contre 16 € : −6,25 %
  await expect(alertes).toContainText(/Tickets Cave [-−]10,0\s%\ssur l’an dernier/)
  await expect(alertes).toContainText(/Panier Bar de 15,00\s€ TTC, [-−]6,3\s%\ssur l’an dernier/)
  await expect(alertes).not.toContainText('Tickets Bar')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await alertes.getByRole('button', { name: /^Agir : Tickets Cave/ }).click()
  await expect(page.getByRole('form', { name: 'Nouvelle action' }).getByLabel('Action')).toHaveValue('Fréquentation Cave : ')
})

test('fiche de visite : chiffres à date, trois sujets, alertes et notes', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('button', { name: 'Fiche de visite' }).click()
  const fiche = page.getByRole('dialog', { name: /Fiche de visite/ })
  await expect(fiche).toContainText(MAGASINS[0])
  const chiffres = fiche.getByRole('table', { name: 'Chiffres à date' })
  await expect(chiffres.getByRole('row', { name: /^Tickets Cave/ })).toContainText(/[-−]10,0\s%/)
  await expect(chiffres.getByRole('row', { name: /^Panier Bar TTC/ })).toContainText(/15,00\s€/)
  const sujets = fiche.getByRole('list', { name: 'Sujets à aborder' }).getByRole('listitem')
  await expect(sujets).toHaveCount(3)
  await expect(fiche.getByRole('list', { name: 'Sujets à aborder' })).toContainText('Tickets Cave')
  await expect(fiche.getByRole('list', { name: 'Sujets à aborder' })).toContainText('Panier Bar')
  await expect(fiche.getByRole('list', { name: 'Alertes du magasin' })).toContainText('Tickets Cave')
  await expect(fiche.getByLabel('Zone de notes')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-visite.png`, fullPage: true })
  await fiche.getByRole('button', { name: 'Fermer' }).click()
  await expect(fiche).toHaveCount(0)
})

test('fiche de visite et leviers : rien pour le franchisé à créer, simulateur sans bouton d’action', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', reel, tickets, magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: null }] })
  await expect(page.getByRole('button', { name: 'Fiche de visite' })).toHaveCount(0)
  await plusLoin(page)
  const leviers = page.getByRole('region', { name: 'Leviers commerciaux' })
  await leviers.getByLabel('Tickets en plus : Cave').fill('2')
  await expect(leviers.getByLabel('Effet sur un an')).toContainText(/CA \+/)
  await expect(leviers.getByRole('button', { name: 'En faire une action' })).toHaveCount(0)
})

test('leviers commerciaux : effet sur un an, « En faire une action » ouvre le plan pré-rempli', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await plusLoin(page)
  const leviers = page.getByRole('region', { name: 'Leviers commerciaux' })
  const effet = leviers.getByLabel('Effet sur un an')
  await expect(effet).toContainText(/CA \+0\sk€/)
  await leviers.getByLabel('Tickets en plus : Cave').fill('2')
  await leviers.getByLabel('Panier en plus : Bar').fill('1')
  await expect(effet).not.toContainText(/CA \+0\sk€/)
  await expect(effet).toContainText('EBE')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await leviers.screenshot({ path: `captures/${info.project.name}-leviers.png` })
  await leviers.getByRole('button', { name: 'En faire une action' }).click()
  const action = page.getByRole('form', { name: 'Nouvelle action' }).getByLabel('Action')
  await expect(action).toHaveValue(/^Cave : \+2,0\s%\sde tickets ; Bar : \+1,00\s€ de panier \(\+[\d\s,]+k€ de marge sur un an\)$/)
  await leviers.getByRole('button', { name: 'Remettre à zéro' }).click()
  await expect(effet).toContainText(/CA \+0\sk€/)
})

test('campagne des budgets : avancement par Responsable Régional, dates dans Paramètres réseau', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, {
    parametres: { campagne: { proposition: '2020-01-01', retour: '2020-01-02', validation: '2020-01-03' } },
    rrs: { [MAGASINS[0]]: ['RR Nord'], [MAGASINS[1]]: ['RR Nord'], [MAGASINS[2]]: ['RR Sud'] },
  })
  const campagne = page.getByRole('region', { name: /^Campagne des budgets \d{4}$/ })
  // Validé, en discussion après la date de validation, sans budget après la date de proposition : 2 en retard
  await expect(campagne).toContainText('1 validé sur 3')
  await expect(campagne).toContainText('2 en retard')
  const parRR = campagne.getByRole('table', { name: 'Par Responsable Régional' })
  await expect(parRR.getByRole('row', { name: /^RR Nord/ }).getByRole('cell')).toHaveText(['RR Nord', '2', '0', '0', '1', '1', '1'])
  await expect(parRR.getByRole('row', { name: /^RR Sud/ }).getByRole('cell')).toHaveText(['RR Sud', '1', '1', '0', '0', '0', '1'])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])

  await page.getByRole('link', { name: /Paramètres/ }).click()
  const dates = page.getByRole('region', { name: 'Campagne des budgets' })
  // Section repliée (lot 30) : le résumé donne les trois dates
  await expect(dates).toContainText('Proposition avant le 01/01, retour avant le 02/01, validation avant le 03/01')
  await dates.getByRole('button', { name: /^Campagne des budgets \d{4} : ouvrir$/ }).click()
  await expect(dates.getByLabel('Budgets validés avant le')).toHaveValue('2020-01-03')
  await dates.getByLabel('Budgets validés avant le').fill('2020-01-01')
  await expect(dates.getByText('Les trois dates se suivent')).toBeVisible()
  await expect(dates.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await dates.getByLabel('Budgets validés avant le').fill('2020-01-20')
  await dates.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Dates de la campagne des budgets \d{4} enregistrées\./)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { campagne: unknown } }
  expect(envoi.valeur.campagne).toEqual({ proposition: '2020-01-01', retour: '2020-01-02', validation: '2020-01-20' })
})

test('campagne : le franchisé voit la date de validation de son budget', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: null, maj_le: null }] })
  // Dates d'exemple : validation le 19 décembre de l'année d'avant le budget
  await expect(page.getByRole('region', { name: 'À faire' })).toContainText(/proposé par le siège, à relire : à valider avant le 19 décembre/)
  await expect(page.getByRole('region', { name: /^Campagne des budgets/ })).toHaveCount(0)
})

test('vue Réseau : CA par heure travaillée avec sa médiane', async ({ page, isMobile }) => {
  test.skip(isMobile, 'colonne du tableau PC')
  await seConnecter(page, { reel, tickets })
  await page.getByRole('link', { name: /Réseau/ }).first().click()
  const tableau = page.getByRole('table', { name: /^Réel \d{4} par magasin$/ })
  await expect(tableau.getByRole('columnheader', { name: 'CA par heure travaillée' })).toBeVisible()
})

test('frais : la barre d’enregistrement montre l’effet sur les frais et l’EBE du budget', async ({ page, isMobile }) => {
  const frais: FraisSimule[] = [{ store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 36_000, taux_ca: null }]
  await seConnecter(page, { frais })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Frais')
  const barre = page.getByRole('region', { name: 'Changements non enregistrés' })
  await expect(barre).toHaveCount(0)
  await page.getByLabel('Locations immobilières', { exact: true }).fill('48000')
  // 12 000 € de loyer en plus : l'EBE du budget baisse d'autant
  await expect(barre).toContainText('1 changement')
  await expect(barre).toContainText(/Frais \d{4}\s36\sk€\s→\s48\sk€/)
  await expect(barre).toContainText(/EBE \d{4}/)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await barre.getByRole('button', { name: 'Annuler les changements' }).click()
  await expect(barre).toHaveCount(0)
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveValue(/36/)
})

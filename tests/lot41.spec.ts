import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { allerVers, ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Lot 41 « budget plus fluide » (Joseph, 02/11/2026) : proposer en série, fiche prête, envoi au siège et revue des
// changements, validation à l'étape 3, objectif d'EBE, « Où en est le magasin », magasins à appeler, grille du réseau.
// Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
// Cave construite par ses tickets (lot 22)
const parTickets = { ...magasinFictif, caParTickets: true }
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const vente = (magasin: string, a: number, m: number, univers: string, famille: string, ca: number, marge: number | null): VenteSimulee =>
  ({ store_name: magasin, mois: mois(a, m), univers, famille, ca_ht: ca, ca_ttc: ca * 1.2, marge_ht: marge })
const reel: VenteSimulee[] = [
  vente(MAGASINS[0], N, 1, 'cave', 'Bière', 30_000, 11_000), vente(MAGASINS[0], N, 1, 'bar', 'Fût', 20_000, 15_000),
  vente(MAGASINS[0], N, 2, 'cave', 'Bière', 20_000, 7_000), vente(MAGASINS[0], N, 2, 'bar', 'Fût', 24_000, 17_000),
  vente(MAGASINS[1], N, 1, 'cave', 'Vin', 30_000, 15_000), vente(MAGASINS[1], N, 2, 'cave', 'Vin', 30_000, 15_000),
]
const tickets: TicketsSimules[] = [
  { store_name: MAGASINS[0], mois: mois(N, 1), univers: 'cave', tickets: 1_000 }, { store_name: MAGASINS[0], mois: mois(N, 2), univers: 'cave', tickets: 900 },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur prépare les propositions en série et envoie celles qu’il coche', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, {
    magasins: [
      { magasin: MAGASINS[0], statut: null, hypotheses: null, maj_le: null },
      { magasin: MAGASINS[1], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-20T09:30:00Z' },
    ],
    reel,
  })
  await allerVers(page, 'Budgets ')
  // Lot 43 : un bouton du bandeau de la campagne ouvre le panneau
  await page.getByRole('region', { name: /^Campagne des budgets/ }).getByRole('button', { name: 'Proposer en série' }).click()
  const serie = page.getByRole('region', { name: 'Proposer en série' })
  await serie.getByRole('button', { name: /^Préparer les propositions/ }).click()
  const tableau = serie.getByRole('table', { name: 'Propositions préparées' })
  await expect(tableau).toBeVisible()
  // Sans équipe ni frais, l'EBE est incomplet : le magasin n'est pas coché d'office
  const ligne = tableau.getByRole('row').filter({ hasText: MAGASINS[0] })
  await expect(ligne).toContainText('Incomplet')
  await expect(ligne).toContainText('Pas encore proposé')
  await expect(serie.getByRole('checkbox', { name: `Proposer : ${MAGASINS[0]}` })).not.toBeChecked()
  // Budget validé : rien à faire
  await expect(serie.getByRole('checkbox', { name: `Mettre à jour : ${MAGASINS[1]}` })).toBeDisabled()
  await expect(serie.getByRole('button', { name: 'Coche les magasins à proposer' })).toBeDisabled()
  await serie.getByRole('checkbox', { name: `Proposer : ${MAGASINS[0]}` }).check()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot41-serie.png`, fullPage: true })
  await serie.getByRole('button', { name: 'Proposer 1 budget' }).click()
  await expect(serie.getByText('1 proposition envoyée aux magasins.')).toBeVisible()
  expect(ecritures.some((e) => e.table === 'budgets' && JSON.stringify(e.corps).includes(MAGASINS[0]))).toBe(true)
})

test('le point de départ dit si la fiche est prête à proposer et mène à ce qui manque', async ({ page, isMobile }) => {
  await seConnecter(page, { magasins: [{ magasin: MAGASINS[0], statut: null, hypotheses: null, maj_le: null }], reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  // 03/11/2026 : la fiche prête à proposer est sur l'atterrissage, dans le Suivi
  await ouvrir(page, 'Atterrissage')
  const fiche = page.getByRole('region', { name: 'Fiche prête à proposer' })
  await expect(fiche.getByRole('heading', { name: /^Fiche prête à \d sur 4$/ })).toBeVisible()
  await expect(fiche).toContainText('Il manque de quoi calculer l’EBE')
  // Date d'ouverture saisie sur place par le Directeur
  await expect(fiche.getByLabel('Mois d’ouverture du magasin')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await fiche.getByRole('button', { name: 'Renseigner : Équipe' }).click()
  await expect(page).toHaveURL(/\/equipe$/)
})

test('le franchisé envoie ses changements au siège ; le Directeur les relit et valide à l’étape 3', async ({ page, isMobile }, info) => {
  const magasin = {
    magasin: MAGASINS[0], statut: 'propose' as const, hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-20T09:30:00Z',
    ajustements: { evolutionPanier: { cave: 0.02 } }, ajustements_siege: {},
  }
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin] })
  await ouvrir(page, 'Échanges')
  const revue = page.getByRole('region', { name: 'Mes changements par rapport au siège' })
  // Une ligne par thème (03/11/2026), le détail à la demande
  await expect(revue.getByRole('row', { name: /^Ventes et marge/ })).toContainText(/^Ventes et marge1/)
  await revue.getByRole('button', { name: 'Voir le détail : Ventes et marge' }).click()
  await expect(revue.getByRole('row', { name: /^Panier moyen Cave/ })).toContainText('au lieu de par défaut')
  await expect(revue.getByRole('row', { name: /^EBE/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Valider le budget' })).toHaveCount(0)
  // Le mot pour le siège est un commentaire, posé avant l'envoi
  const commentaires = page.getByRole('region', { name: 'Commentaires', exact: true })
  await commentaires.getByRole('textbox', { name: 'Commenter : Le budget en général' }).fill('Le panier monte avec la nouvelle gamme.')
  await commentaires.getByRole('button', { name: 'Commenter', exact: true }).click()
  await expect(commentaires.getByRole('listitem')).toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot41-envoi.png`, fullPage: true })
  await revue.getByRole('button', { name: 'Envoyer au siège' }).click()
  await expect(page.getByText('Budget envoyé au siège : il est en discussion.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { statut: string; envoye_le?: string }
  expect(envoi.statut).toBe('en_discussion')
  expect(envoi.envoye_le).toBeTruthy()
  expect(ecritures.some((e) => e.table === 'echanges_budget' && JSON.stringify(e.corps).includes('nouvelle gamme'))).toBe(true)
})

test('le Directeur voit ce que le magasin a changé et ce qu’il faut regarder avant de valider', async ({ page, isMobile }) => {
  await seConnecter(page, {
    magasins: [{
      magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, maj_le: '2026-10-20T09:30:00Z',
      ajustements: { evolutionPanier: { cave: 0.02 } }, ajustements_siege: {}, envoye_le: '2026-11-03T09:00:00Z',
    }],
  })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Cartes des hypothèses')
  await expect(page.getByRole('button', { name: 'Valider le budget' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Revoir et valider' }).click()
  const revue = page.getByRole('region', { name: 'Ce que le magasin a changé' })
  await expect(revue).toContainText('Envoyé au siège le 3 novembre')
  await expect(revue.getByRole('row', { name: /^Ventes et marge/ })).toBeVisible()
  await expect(revue).toContainText('La trésorerie au 1er janvier n’est pas saisie')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await revue.getByRole('button', { name: 'Valider le budget' }).click()
  await expect(page.getByText('Budget 2027 validé.')).toBeVisible()
})

test('objectif d’EBE : la valeur de chaque levier, reportée dans les hypothèses en un clic', async ({ page, isMobile }) => {
  await seConnecter(page, { magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: parTickets, base: parTickets, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat')
  // Joseph (03/11/2026) : l'objectif d'EBE est dans le simulateur « Que faut-il pour… »
  const objectif = page.getByRole('region', { name: 'Que faut-il pour…' })
  await objectif.getByLabel('EBE visé').fill('30000')
  await expect(objectif).toContainText(/Aujourd’hui 23\sk€ : il manque 6,8\sk€/)
  const leviers = objectif.getByRole('table', { name: 'Leviers pour atteindre : ebe visé' })
  await expect(leviers.getByRole('row', { name: /^Tickets Cave/ })).toBeVisible()
  await expect(leviers.getByRole('row', { name: /^Masse salariale/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await leviers.getByRole('button', { name: /^Appliquer : Tickets Cave/ }).click()
  await expect(page.getByText('Valeur reportée dans les hypothèses. Enregistre les ajustements pour la garder.')).toBeVisible()
})

test('« Où en est le magasin » : l’écart au budget expliqué par les tickets, le panier et la marge', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: parTickets, maj_le: null }], reel, tickets })
  await ouvrir(page, 'Où en est le magasin')
  const ecart = page.getByRole('region', { name: 'D’où vient l’écart au budget' })
  await expect(ecart.getByRole('heading', { name: 'D’où vient l’écart au budget, à fin février' })).toBeVisible()
  const ca = ecart.getByRole('list', { name: 'Écart de chiffre d’affaires par effet' })
  await expect(ca).toContainText('Tickets Cave')
  await expect(ca).toContainText('Panier moyen Cave')
  await expect(ecart.getByRole('list', { name: 'Écart de marge par effet' })).toContainText('Effet du taux de marge')
  // Le suivi mois par mois est sur la même page, replié
  await expect(page.getByRole('region', { name: `Réel et budget ${N} mois par mois` })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot41-ou-en-est.png`, fullPage: true })
})

test('Ma semaine ne met en tête que les magasins à appeler', async ({ page, isMobile }) => {
  await seConnecter(page, {
    magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: null }, { magasin: MAGASINS[1], statut: null, hypotheses: null, maj_le: null }],
    reel, tickets,
  })
  await allerVers(page, 'Suivi ')
  const semaine = page.getByRole('region', { name: 'Ma semaine' })
  await expect(semaine.getByRole('heading', { name: /^Ma semaine : (\d+ magasins? à appeler|rien d’urgent)/ })).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('hypothèses du réseau en une grille : tous les magasins, puis par ancienneté ; le détail par famille replié', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }] })
  await allerVers(page, 'Hypothèses du réseau')
  const grille = page.getByRole('table', { name: 'Hypothèses du réseau par ancienneté' })
  await expect(grille.getByRole('columnheader')).toHaveText([/^Hypothèse/, /^Tous les magasins/, /^Année 1/, /^Année 2/, /^Année 3/, /^Année 4 et plus/])
  await expect(grille.getByRole('row', { name: /^Tickets Cave/ })).toBeVisible()
  await expect(grille.getByRole('row', { name: /^CA Bar/ })).toBeVisible()
  await page.getByLabel('Hausse tarifaire du réseau').fill('2')
  // Sans valeur propre, le panier du réseau reprend la hausse tarifaire
  await expect(page.getByLabel('Évolution du panier moyen : Cave')).toHaveAttribute('placeholder', '2')
  await page.getByLabel('Salaires et frais : Inflation des frais').fill('1,5')
  await page.getByLabel('Année 1 : évolution des tickets Cave').fill('10')
  await expect(page.getByLabel('Part de la famille dans son univers : Bière (Cave)')).toBeHidden()
  await page.getByRole('button', { name: /[Dd]étail par famille/ }).click()
  await expect(page.getByLabel('Part de la famille dans son univers : Bière (Cave)')).toBeVisible()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot41-grille.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Cibles enregistrées.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'cibles_reseau')?.corps).toEqual({ annee: 2027, valeur: { hausseTarifaire: 0.02, inflationFrais: 0.015, millesimes: { 1: { evolutionFlux: { cave: 0.1 } } } } })
})

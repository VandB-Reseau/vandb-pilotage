import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type PartSimulee, type TicketsSimules, type VenteSimulee, plusLoin } from './supabase-simule'

// Frais ligne par ligne et atterrissage de l'année en cours ; le Directeur en tire le budget de l'an prochain.
// Données fictives uniquement : dépôt public. Mêmes chiffres que tests/moteur/atterrissage.spec.ts, vérifiés à la main.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0) // année du budget, comme l'app
const mois = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}-01`
const reelPour = (magasin: string): VenteSimulee[] => [
  { store_name: magasin, mois: mois(N, 1), univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 3_600 },
  { store_name: magasin, mois: mois(N, 2), univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 7_200 },
  { store_name: magasin, mois: mois(N, 1), univers: 'bar', famille: 'Fût', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 7_400 },
  // N-1 : Cave 1 000 par mois, 4 000 en décembre
  ...Array.from({ length: 12 }, (_, i) => ({ store_name: magasin, mois: mois(N - 1, i + 1), univers: 'cave', famille: 'Vin', ca_ht: i === 11 ? 4_000 : 1_000, ca_ttc: null, marge_ht: null })),
]
const ticketsPour = (magasin: string): TicketsSimules[] => [{ store_name: magasin, mois: mois(N, 1), univers: 'cave', tickets: 600 }]
const loyer = (magasin: string): FraisSimule => ({ store_name: magasin, code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Coach renseigne les frais : lignes courantes, part du CA, emprunts, ligne retirée', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'coach' })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Frais')
  await expect(page.getByText('Pas encore de frais')).toBeVisible()
  await page.getByRole('button', { name: 'Partir des lignes courantes' }).click()

  await page.getByLabel('Locations immobilières', { exact: true }).fill('60 000')
  await page.getByLabel('Unité : Électricité, eau, gaz').click()
  await page.getByRole('option', { name: '% du CA' }).click()
  await page.getByLabel('Électricité, eau, gaz', { exact: true }).fill('1,3')
  await page.getByLabel('Intérêts sur emprunts').fill('1200')
  await page.getByRole('button', { name: 'Retirer Cotisation foncière des entreprises' }).click()
  const chiffres = page.getByRole('region', { name: 'Frais en chiffres' })
  await expect(chiffres).toContainText(/60\sk€/)
  await expect(chiffres).toContainText(/4,3\s%\sdu CA/)              // énergie 1,3 % + publicité franchise 1 % + royalties 2 %
  // Un groupe par thème dans un seul tableau (lot 35) ; publicité franchise et royalties calculées sur le CA ; totaux des blocs de l'onglet FFBUD
  await expect(page.getByRole('rowgroup', { name: 'Immobilier' })).toContainText(/60\s000\s€/)
  await expect(page.getByRole('rowgroup', { name: 'Redevances du réseau' }).getByRole('row', { name: /^Royalties/ })).toContainText(/2,0\s%\sdu CA/)
  await expect(page.getByLabel('Budget communication annuel', { exact: true })).toBeVisible()
  const blocs = page.getByRole('rowgroup', { name: 'Totaux' })
  await expect(blocs.getByRole('row', { name: /^Total des charges externes/ })).toContainText(/60\s000\s€ \+ 4,3\s%\sdu CA/)
  await expect(blocs.getByRole('row', { name: /^Intérêts et charges assimilées/ })).toContainText(/1\s200\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-frais.png`, fullPage: true })

  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Frais enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'frais' && e.methode === 'POST')?.corps as FraisSimule[]
  // Lignes vides écartées : seuls l'énergie, le loyer et les intérêts partent, dans l'ordre de la grille
  expect(envoi).toEqual([
    { store_name: MAGASINS[0], code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: null, taux_ca: 0.013 },
    { store_name: MAGASINS[0], code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier', annuel: 60_000, taux_ca: null },
    { store_name: MAGASINS[0], code: 'interets', libelle: 'Intérêts sur emprunts', rubrique: 'hors_exploitation', annuel: 1_200, taux_ca: null },
  ])
  await expect(page.getByRole('button', { name: 'Enregistrer les frais' })).toHaveCount(0)

  // Retirer une ligne enregistrée l'efface en base
  await page.getByRole('button', { name: 'Retirer Électricité, eau, gaz' }).click()
  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Frais enregistrés.')).toBeVisible()
  const effacement = ecritures.find((e) => e.table === 'frais' && e.methode === 'DELETE')
  expect(decodeURIComponent(effacement?.filtre ?? '')).toContain('code=in.(energie)')
})

test('une ligne de frais s’ajoute depuis la grille ; un montant illisible est signalé', async ({ page }) => {
  // 1 200 lignes d'autres magasins avant la sienne : la lecture se fait par pages de 1 000
  const autres = Array.from({ length: 1200 }, (_, i) => ({ ...loyer(`Magasin ${i}`), code: 'telecom' }))
  await seConnecter(page, { role: 'franchise', frais: [...autres, loyer(MAGASINS[0])] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Frais')
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveValue('60 000')
  await page.getByRole('button', { name: 'Ajouter une ligne : Honoraires' }).click()
  await page.getByRole('menuitem', { name: 'Honoraires de comptabilité' }).click()
  await page.getByLabel('Honoraires de comptabilité', { exact: true }).fill('six mille')
  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Honoraires de comptabilité : montant illisible.')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler les changements' }).click()
  await expect(page.getByLabel('Honoraires de comptabilité', { exact: true })).toHaveCount(0)
})

test('synthèse et atterrissage : réel des mois passés, saisonnalité de l’an dernier, frais du magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'rr', reel: reelPour(MAGASINS[0]), tickets: ticketsPour(MAGASINS[0]), frais: [loyer(MAGASINS[0])] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page).toHaveURL(/\/synthese$/)
  const sante = page.getByRole('region', { name: 'Santé du magasin à fin février' })
  // Cumul 40 000 contre 2 000 aux mêmes mois de l'an dernier ; marge 18 200 / 40 000 = 45,5 %
  await expect(sante).toContainText(/40\sk€/)
  await expect(sante).toContainText(/1\s900,0\s%\ssur/)
  // Bière 30 000 / (2 000 / 15 000) + Fût 10 000 × 6 = 285 000
  await expect(sante).toContainText(/Atterrissage \d+ : 285\sk€/)
  await expect(sante).toContainText(/45,5\s%/)
  await expect(sante).toContainText('À renseigner')
  // EBE : marge 81 000 + 44 400 = 125 400 − redevance et publicité 8 550 − loyer 60 000 = 56 850
  await expect(sante).toContainText(/57\sk€/)
  await expect(page.getByText('Équipe non renseignée :', { exact: false })).toBeVisible()
  await expect(page.getByText('Frais non renseignés', { exact: false })).toHaveCount(0)
  // Face au budget de l'année (lot 27) : 7,5 % de 640 000 € en janvier et en février = 96 000 €, 40 000 / 96 000 − 1 = −58,3 %
  await expect(sante).toContainText(/58,3\s%\sface au budget/)
  await expect(sante).toContainText(/Budget à date : 96\sk€/)
  // Courbe cumulée d'office ; en décembre : réel 40 000, projection jusqu'à l'atterrissage 285 000, budget 640 000,
  // an dernier 11 × 1 000 + 4 000 = 15 000
  await plusLoin(page)
  const graphique = page.getByRole('region', { name: /^Chiffre d’affaires \d+$/ })
  await graphique.locator('[data-mois="12"]').click()
  const bulle = page.getByRole('tooltip')
  await expect(bulle).toContainText(/Projection\s*285\s000\s€/)
  await expect(bulle).toContainText(/Budget \d+\s*640\s000\s€/)
  await expect(bulle).toContainText(/Réel \d+\s*15\s000\s€/)
  await graphique.locator('[data-mois="2"]').click()
  await expect(bulle).toContainText(new RegExp(`Réel ${N}\\s*40\\s000\\s€`))
  // Mois par mois : au survol de décembre, projection 15 000 × 4 + 5 000 = 65 000, et 4 000 l'an dernier
  await graphique.getByRole('button', { name: 'Mois par mois' }).click()
  await graphique.locator('[data-mois="12"]').click()
  await expect(bulle).toContainText('décembre')
  await expect(bulle).toContainText(/Projection\s*65\s000\s€/)
  await expect(bulle).toContainText(/4\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-synthese.png`, fullPage: true })

  await ouvrir(page, 'Atterrissage')
  await expect(page.getByRole('button', { name: /Proposer le budget/ })).toHaveCount(0)
  const tableau = page.getByRole('table', { name: `Atterrissage ${N} mois par mois` })
  await expect(tableau.getByRole('columnheader', { name: 'Févr.', exact: true })).toBeVisible()
  await expect(tableau.getByRole('columnheader', { name: 'Mars (projection)' })).toBeVisible()
  await expect(tableau.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/65\s000/)
  await expect(tableau.getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/285\s000\s€/)
  await expect(tableau.getByRole('row', { name: /^Excédent brut/ })).toContainText(/56\s850\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-atterrissage.png`, fullPage: true })
  // D'où vient ce chiffre : Cave 30 000 réalisés ÷ 2 000 / 15 000 de l'an dernier ; Bar sans an dernier
  await page.getByRole('button', { name: 'Comment c’est calculé : Chiffre d’affaires HT atterri' }).click()
  const calcul = page.getByRole('table', { name: `Calcul : Chiffre d’affaires HT atterri ${N}` })
  await expect(calcul.getByRole('row', { name: /^Réalisé de janvier à février/ }).first()).toContainText(/30\s000\s€/)
  await expect(calcul.getByRole('row', { name: /^Part de l’année réalisée/ }).first()).toContainText(/225\s000\s€/)
  await expect(calcul.getByRole('row').last()).toContainText(/285\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Fermer' }).click()

  await ouvrir(page, 'Synthèse')
  await page.getByRole('button', { name: 'Renseigner l’équipe' }).click()
  await expect(page).toHaveURL(/\/equipe$/)
})

test('le Directeur propose le budget de l’an prochain à partir de l’atterrissage', async ({ page }) => {
  const ecritures = await seConnecter(page, { reel: reelPour(MAGASINS[2]), tickets: ticketsPour(MAGASINS[2]), frais: [loyer(MAGASINS[2])] })
  await page.getByText(MAGASINS[2], { exact: true }).last().click()
  await ouvrir(page, 'Cartes des hypothèses')
  await expect(page.getByText(`Pas encore de budget ${B}`)).toBeVisible()
  await page.getByRole('button', { name: `Voir l’atterrissage ${N}` }).click()
  await page.getByRole('button', { name: `Proposer le budget ${B}` }).click()
  await expect(page.getByText(`Budget ${B} proposé à partir de l’atterrissage ${N}.`)).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets')?.corps as { annee: number; statut: string; base: { annee: number; caMensuelReference: number[]; frais: { code: string }[] } }
  expect(envoi.annee).toBe(B)
  expect(envoi.statut).toBe('propose')
  expect(envoi.base.annee).toBe(B)
  expect(envoi.base.frais.map((f) => f.code)).toEqual(['loyer'])
  expect(envoi.base.caMensuelReference[11]).toBeCloseTo(65_000, 6)
  await expect(page.getByRole('button', { name: `Mettre à jour la proposition ${B}` })).toBeVisible()
  await ouvrir(page, 'Cartes des hypothèses')
  await expect(page.getByRole('complementary', { name: 'Impact des changements' })).toBeVisible()
})

test('sans réel de l’année, l’atterrissage renvoie vers le réel', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Atterrissage')
  const atterrissage = page.locator('main').getByRole('region', { name: `Atterrissage ${N}`, exact: true })
  await expect(atterrissage.getByText(`Pas encore de réel ${N}`)).toBeVisible()
  await atterrissage.getByRole('button', { name: 'Voir le réel' }).click()
  await expect(page.getByRole('group', { name: 'Année du réel' }).getByRole('button', { name: String(N), exact: true })).toHaveAttribute('aria-pressed', 'true')
})

// Joseph (03/11/2026) : la carte « Saisonnalité » de l'atterrissage (part de l'année réalisée par univers) est retirée ;
// le calcul reste automatique, une part déjà enregistrée reste prise en compte
test('atterrissage sans carte « Saisonnalité » : projection automatique, part déjà enregistrée reprise', async ({ page, isMobile }) => {
  // Cave : 10 000 € par mois de janvier à août, pas d'an dernier
  const reel: VenteSimulee[] = Array.from({ length: 8 }, (_, i) => ({ store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 3_600 }))
  await seConnecter(page, { role: 'franchise', reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Atterrissage')
  const atterrissage = page.locator('main').getByRole('region', { name: `Atterrissage ${N}`, exact: true })
  // Sans part ni réseau : la moyenne, 80 000 × 12 / 8 = 120 000
  await expect(atterrissage.getByRole('region', { name: `Atterrissage ${N} en chiffres` })).toContainText(/120\s?k€/)
  await expect(atterrissage.getByRole('region', { name: 'Saisonnalité', exact: true })).toHaveCount(0)
  await expect(page.getByRole('table', { name: `Mois restants ${N} par univers` })).toHaveCount(0)
  await expect(page.getByLabel('Part de l’année réalisée : Cave')).toHaveCount(0)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('une part de l’année déjà enregistrée reste prise en compte', async ({ page }) => {
  const reel: VenteSimulee[] = Array.from({ length: 8 }, (_, i) => ({ store_name: MAGASINS[0], mois: mois(N, i + 1), univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 3_600 }))
  const parts: PartSimulee[] = [{ store_name: MAGASINS[0], annee: N, univers: 'cave', part: 0.626 }]
  await seConnecter(page, { role: 'franchise', reel, parts })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Atterrissage')
  // 80 000 / 0,626 = 127 796
  await expect(page.locator('main').getByRole('region', { name: `Atterrissage ${N} en chiffres` })).toContainText(/128\s?k€/)
})

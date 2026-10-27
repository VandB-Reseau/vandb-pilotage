import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type TicketsSimules, type VenteSimulee } from './supabase-simule'

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
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: 'Frais' }).click()
  await expect(page.getByText('Pas encore de frais')).toBeVisible()
  await page.getByRole('button', { name: 'Partir des lignes courantes' }).click()

  await page.getByLabel('Locations immobilières', { exact: true }).fill('60 000')
  await page.getByLabel('Unité : Électricité, eau, gaz').click()
  await page.getByRole('option', { name: '% du CA' }).click()
  await page.getByLabel('Électricité, eau, gaz', { exact: true }).fill('1,3')
  await page.getByLabel('Intérêts d’emprunts').fill('1200')
  await page.getByRole('button', { name: 'Retirer Cotisation foncière des entreprises' }).click()
  const chiffres = page.getByRole('region', { name: 'Frais en chiffres' })
  await expect(chiffres).toContainText(/60\sk€/)
  await expect(chiffres).toContainText(/1,3\s%\sdu CA/)
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
    { store_name: MAGASINS[0], code: 'interets', libelle: 'Intérêts d’emprunts', rubrique: 'hors_exploitation', annuel: 1_200, taux_ca: null },
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
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: 'Frais' }).click()
  await expect(page.getByLabel('Locations immobilières', { exact: true })).toHaveValue('60000')
  await page.getByLabel('Ajouter une ligne').fill('Honoraires compt')
  await page.getByRole('option', { name: 'Honoraires comptables' }).click()
  await page.getByLabel('Honoraires comptables', { exact: true }).fill('six mille')
  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Honoraires comptables : montant illisible.')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler les modifications' }).click()
  await expect(page.getByLabel('Honoraires comptables', { exact: true })).toHaveCount(0)
})

test('atterrissage : réel des mois passés, saisonnalité de l’an dernier, frais du magasin', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'rr', reel: reelPour(MAGASINS[0]), tickets: ticketsPour(MAGASINS[0]), frais: [loyer(MAGASINS[0])] })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: `Atterrissage ${N}` }).click()
  const chiffres = page.getByRole('region', { name: `Atterrissage ${N} en chiffres` })
  // Bière 30 000 / (2 000 / 15 000) + Fût 10 000 × 6 = 285 000 ; marge 81 000 + 44 400 = 125 400 (44,0 %)
  await expect(chiffres).toContainText(/285\sk€/)
  await expect(chiffres).toContainText('Réalisé à fin février : 40')
  await expect(chiffres).toContainText(/44,0\s%/)
  // EBE : 125 400 − redevance et publicité 8 550 − loyer 60 000 = 56 850
  await expect(chiffres).toContainText(/57\sk€/)
  await expect(page.getByText('Équipe non renseignée', { exact: false })).toBeVisible()
  await expect(page.getByText('Frais non renseignés', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Proposer le budget/ })).toHaveCount(0)
  const tableau = page.getByRole('table', { name: `Atterrissage ${N} mois par mois` })
  await expect(tableau.getByRole('row', { name: /Févr\./ })).toContainText('Réel')
  await expect(tableau.getByRole('row', { name: /Déc\./ })).toContainText('Projection')
  await expect(tableau.getByRole('row', { name: /Déc\./ })).toContainText(/65\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-atterrissage.png`, fullPage: true })

  await page.getByRole('button', { name: 'Renseigner l’équipe' }).click()
  await expect(page.getByRole('tab', { name: 'Équipe' })).toHaveAttribute('aria-selected', 'true')
})

test('le Directeur propose le budget de l’an prochain à partir de l’atterrissage', async ({ page }) => {
  const ecritures = await seConnecter(page, { reel: reelPour(MAGASINS[2]), tickets: ticketsPour(MAGASINS[2]), frais: [loyer(MAGASINS[2])] })
  await page.getByText(MAGASINS[2], { exact: true }).click()
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
  await page.getByRole('tab', { name: `Budget ${B}` }).click()
  await expect(page.getByRole('region', { name: 'Indicateurs clés' })).toBeVisible()
})

test('sans réel de l’année, l’atterrissage renvoie vers le réel', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await page.getByText(MAGASINS[0], { exact: true }).click()
  await page.getByRole('tab', { name: `Atterrissage ${N}` }).click()
  await expect(page.getByText(`Pas encore de réel ${N}`)).toBeVisible()
  await page.getByRole('button', { name: 'Voir le réel' }).click()
  await expect(page.getByRole('button', { name: String(N), exact: true })).toHaveAttribute('aria-pressed', 'true')
})

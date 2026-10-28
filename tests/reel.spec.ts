import { expect, test } from '@playwright/test'
import { MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type TicketsSimules, type VenteSimulee } from './supabase-simule'

// Réel de l'année : import des fichiers de la DSI par le Directeur, consultation et saisie d'un mois dans la fiche magasin.
// Données fictives uniquement (codes caisse et montants inventés) : dépôt public.

const N = new Date().getFullYear()
const fichier = (nom: string) => new URL(`./fichiers/${nom}`, import.meta.url).pathname

// Janvier et février de l'année en cours pour le premier magasin fictif
const reel: VenteSimulee[] = [
  { store_name: MAGASINS[0], mois: `${N}-01-01`, univers: 'cave', famille: 'Bière', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 3_600 },
  { store_name: MAGASINS[0], mois: `${N}-01-01`, univers: 'bar', famille: 'Fût', ca_ht: 10_000, ca_ttc: 12_000, marge_ht: 7_400 },
  { store_name: MAGASINS[0], mois: `${N}-02-01`, univers: 'cave', famille: 'Bière', ca_ht: 20_000, ca_ttc: 24_000, marge_ht: 7_200 },
]
const tickets: TicketsSimules[] = [
  { store_name: MAGASINS[0], mois: `${N}-01-01`, univers: 'cave', tickets: 600 },
  { store_name: MAGASINS[0], mois: `${N}-01-01`, univers: 'bar', tickets: 400 },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur importe les fichiers du mois, rattache un code caisse inconnu, puis enregistre', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { codes: [{ code: '0101', store_name: MAGASINS[0] }] })
  await page.getByRole('link', { name: /Imports/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Imports de caisse' })).toBeVisible()
  await page.getByLabel('Fichiers de ventes et de tickets').setInputFiles([fichier('ventes_2026-09.csv'), fichier('tickets_2026-09.csv')])

  await expect(page.getByText('3 lignes sont écartées', { exact: false })).toBeVisible()
  await expect(page.getByText('ventes_2026-09.csv, ligne 10 : date « 2026-13-01 » illisible', { exact: false })).toBeVisible()
  await expect(page.getByText('Famille « KOMBUCHA » absente de la liste du réseau', { exact: false })).toBeVisible()
  const inconnus = page.getByRole('region', { name: 'Codes caisse inconnus' })
  await expect(inconnus).toContainText('2 codes caisse ne sont rattachés à aucun magasin')
  // 0101 : 1 500,50 + 2 000 + 800 en septembre
  const apercu = page.getByRole('table', { name: 'Aperçu de l’import' })
  await expect(apercu.getByRole('row', { name: /septembre 2026/ })).toContainText(/4\s301\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-imports.png`, fullPage: true })

  await page.getByLabel('Magasin du code 0102').click()
  await page.getByRole('option', { name: MAGASINS[1] }).click()
  await expect(page.getByText(`Code 0102 rattaché à ${MAGASINS[1]}.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'codes_caisse')?.corps).toEqual({ code: '0102', store_name: MAGASINS[1] })
  await expect(inconnus).toContainText('Un code caisse n’est rattaché à aucun magasin')
  await expect(apercu.getByRole('row', { name: new RegExp(MAGASINS[1]) })).toContainText(/3\s050\s€/)

  await page.getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByText('Réel importé : septembre 2026, octobre 2026, 2 magasins.', { exact: false })).toBeVisible()
  const envois = ecritures.filter((e) => e.table === 'rpc/remplacer_reel').map((e) => e.corps as { p_ventes: VenteSimulee[]; p_tickets: TicketsSimules[] })
  expect(envois).toHaveLength(2)
  expect(envois[0].p_ventes).toContainEqual({ store_name: MAGASINS[0], mois: '2026-09-01', univers: 'cave', famille: 'Bière', ca_ht: 1500.5, ca_ttc: 1800.6, marge_ht: 540.18 })
  expect(envois[0].p_ventes.some((v) => v.famille === 'Vin' && v.ca_ht === 10)).toBe(false)
  expect(envois[0].p_tickets).toContainEqual({ store_name: MAGASINS[1], mois: '2026-09-01', univers: 'exterieur', tickets: 2 })
  expect(envois[1].p_ventes).toEqual([{ store_name: MAGASINS[0], mois: '2026-10-01', univers: 'cave', famille: 'Bière', ca_ht: 100, ca_ttc: 120, marge_ht: 36 }])
})

test('un fichier qui n’est pas celui de la DSI est expliqué ; un code caisse se retire', async ({ page }) => {
  const ecritures = await seConnecter(page, { codes: [{ code: '0101', store_name: MAGASINS[0] }] })
  await page.getByRole('link', { name: /Imports/ }).click()
  await page.getByLabel('Fichiers de ventes et de tickets').setInputFiles({ name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from('magasin;jour;total\n1;2;3\n') })
  await expect(page.getByText('export.csv : ce n’est ni un fichier de ventes ni un fichier de tickets', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importer' })).toBeDisabled()
  await page.getByRole('button', { name: 'Retirer le code 0101' }).click()
  await expect(page.getByText('Code 0101 retiré.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'codes_caisse')?.filtre).toContain('code=eq.0101')
  await expect(page.getByText('Aucun code caisse rattaché pour l’instant', { exact: false })).toBeVisible()
})

test('le franchisé lit le réel de son magasin et saisit le mois suivant', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Réel/ }).click()
  const chiffres = page.getByRole('region', { name: `Réel ${N} en chiffres` })
  // 40 000 de CA, 18 200 de marge (45,5 %) ; Cave et Bar séparés : 12 000 TTC / 600 tickets, 12 000 / 400
  await expect(chiffres).toContainText(/40\sk€/)
  await expect(chiffres).toContainText('De janvier à fin février')
  await expect(chiffres).toContainText(/45,5\s%/)
  await expect(chiffres).toContainText(/Panier Cave TTC\s*20,00\s€/)
  await expect(chiffres).toContainText(/Panier Bar TTC\s*30,00\s€/)
  await expect(chiffres).toContainText(/Tickets Cave\s*600/)
  const tableau = page.getByRole('table', { name: `Réel ${N} par famille et par mois` })
  await expect(tableau.getByRole('row', { name: /Bière \(Cave\)/ })).toContainText(/30\s000\s€/)
  await expect(tableau.getByRole('row', { name: /Bière \(Cave\)/ })).toContainText(/75,0\s%/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reel.png`, fullPage: true })

  await page.getByRole('button', { name: 'Saisir un mois' }).click()
  const saisie = page.getByRole('region', { name: /Réel du mois/ })
  await expect(saisie.getByLabel('Mois')).toContainText(`mars ${N}`)
  await saisie.getByLabel('Marge HT : Vin (Cave)').fill('500')
  await saisie.getByRole('button', { name: 'Enregistrer le mois' }).click()
  await expect(saisie.getByText('Vin (Cave) : le CA HT manque.')).toBeVisible()
  await saisie.getByLabel('Marge HT : Vin (Cave)').fill('')
  await saisie.getByLabel('CA HT : Bière (Cave)').fill('12 500,50')
  await saisie.getByLabel('CA TTC : Bière (Cave)').fill('15000,6')
  await saisie.getByLabel('Marge HT : Bière (Cave)').fill('4500')
  await saisie.getByLabel('Tickets Cave').fill('625')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-saisie-mois.png` })
  await saisie.getByRole('button', { name: 'Enregistrer le mois' }).click()
  await expect(page.getByText(`Réel de mars ${N} enregistré.`)).toBeVisible()
  expect(ecritures.find((e) => e.table === 'rpc/remplacer_reel')?.corps).toEqual({
    p_ventes: [{ store_name: MAGASINS[0], mois: `${N}-03-01`, univers: 'cave', famille: 'Bière', ca_ht: 12500.5, ca_ttc: 15000.6, marge_ht: 4500 }],
    p_tickets: [{ store_name: MAGASINS[0], mois: `${N}-03-01`, univers: 'cave', tickets: 625 }],
  })
  await expect(chiffres).toContainText('De janvier à fin mars')
  await expect(tableau.getByRole('row', { name: /Bière \(Cave\)/ })).toContainText(/42\s501\s€/)
})

test('un mois déjà saisi se corrige ; vidé, il est effacé', async ({ page }) => {
  const ecritures = await seConnecter(page, { role: 'coach', reel, tickets })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Réel/ }).click()
  await page.getByRole('button', { name: `Saisir février ${N}` }).click()
  const saisie = page.getByRole('region', { name: /Réel du mois/ })
  await expect(saisie.getByLabel('CA HT : Bière (Cave)')).toHaveValue('20000')
  await saisie.getByLabel('CA HT : Bière (Cave)').fill('')
  await saisie.getByLabel('CA TTC : Bière (Cave)').fill('')
  await saisie.getByLabel('Marge HT : Bière (Cave)').fill('')
  await saisie.getByRole('button', { name: 'Enregistrer le mois' }).click()
  await expect(page.getByText(`Réel de février ${N} enregistré.`)).toBeVisible()
  const effacement = ecritures.find((e) => e.table === 'reel_mensuel' && e.methode === 'DELETE')
  expect(effacement?.filtre).toContain(`mois=eq.${N}-02-01`)
  await expect(page.getByRole('region', { name: `Réel ${N} en chiffres` })).toContainText('De janvier à fin janvier')
})

test('sans chiffres, l’année l’explique et propose la saisie ; le Coach n’a pas les imports', async ({ page }) => {
  await seConnecter(page, { role: 'coach', reel, tickets })
  await expect(page.getByRole('link', { name: /Imports/ })).toHaveCount(0)
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Réel/ }).click()
  await page.getByRole('button', { name: String(N - 1), exact: true }).click()
  await expect(page.getByText(`Pas encore de chiffres réels ${N - 1}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Saisir un mois' })).toBeVisible()
  await page.goto('./#/imports')
  await expect(page.getByRole('heading', { level: 1, name: 'Magasins' })).toBeVisible()
})

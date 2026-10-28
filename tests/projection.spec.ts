import { expect, test } from '@playwright/test'
import type { Hypotheses } from '../src/moteur/types'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Projection du CA (lot 24) : rythme de sortie, ancienneté, temps forts, clients gagnés ou perdus, opérations du réseau.
// Données fictives : dépôt public. Les montants viennent du moteur, vérifié à la main dans tests/moteur/projection.spec.ts.
// Magasin fictif : Cave 200 000 attendus (10 000 tickets), Bar 300 000, Extérieur 100 000.

const avecSortie = (ca: number): Hypotheses => ({ ...magasinFictif, sortie: { cave: { ca, poids: 0.3, de: 5, a: 8 } } })
const magasin = (base: Hypotheses, statut: MagasinSimule['statut'] = 'propose', ajustements = {}): MagasinSimule =>
  ({ magasin: MAGASINS[0], statut, hypotheses: base, base, ajustements, maj_le: null })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur voit le rythme de sortie, le retient au-delà de 15 % et renseigne la date d’ouverture', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: [magasin(avecSortie(75_000))] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const base = page.getByRole('region', { name: 'Base du CA' })
  const cave = base.getByRole('row', { name: /^Cave/ })
  // 75 000 de mai à août pour 30 % de l'année : 250 000 au rythme actuel, + 25 % sur les 200 000 attendus
  await expect(cave).toContainText(/200\sk€/)
  await expect(cave).toContainText(/250\sk€/)
  await expect(cave).toContainText('mai à août')
  await expect(cave).toContainText('Écart de plus de 15 % : à confirmer')
  const resultat = page.getByRole('table', { name: 'Budget 2027 mois par mois' })
  const ca = resultat.getByRole('row', { name: /^Chiffre d’affaires HT/ })
  await expect(ca).toContainText(/600\s000\s€/)
  await base.getByRole('button', { name: 'Retenir le rythme Cave' }).click()
  await expect(cave).toContainText('Rythme de sortie retenu')
  await expect(ca).toContainText(/650\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-base-ca.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: unknown }
  expect(envoi.ajustements).toEqual({ rythme: { cave: 'applique' } })

  // Date d'ouverture : février 2025, le magasin est dans sa 3e année en 2027
  await expect(base).toContainText('Date d’ouverture à renseigner')
  await page.getByLabel('Mois d’ouverture du magasin').fill('2025-02')
  await base.getByRole('button', { name: 'Enregistrer la date' }).click()
  await expect(page.getByText('Date d’ouverture enregistrée.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'ouvertures')?.corps).toEqual({ store_name: MAGASINS[0], ouverture: '2025-02-01' })
  await expect(base).toContainText('Ouvert en février 2025 · Année 3 en 2027')
})

test('sous 15 % le rythme s’applique de lui-même ; un Coach le lit sans pouvoir le changer', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [magasin(avecSortie(66_000))], ouvertures: [{ store_name: MAGASINS[0], ouverture: '2026-01-01' }] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const base = page.getByRole('region', { name: 'Base du CA' })
  // 66 000 / 30 % = 220 000, + 10 % : retenu ; 220 000 + 300 000 + 100 000
  await expect(base.getByRole('row', { name: /^Cave/ })).toContainText('Rythme de sortie retenu')
  await expect(page.getByRole('table', { name: 'Budget 2027 mois par mois' }).getByRole('row', { name: /^Chiffre d’affaires HT/ })).toContainText(/620\s000\s€/)
  await expect(base).toContainText('Année 2 en 2027')
  await expect(base.getByRole('button', { name: /rythme/i })).toHaveCount(0)
  await expect(page.getByLabel('Mois d’ouverture du magasin')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prévoir un temps fort' })).toHaveCount(0)
})

test('le franchisé prévoit un temps fort et un client gagné : la base perd l’an passé, le budget gagne l’an prochain', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin(magasinFictif)] })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const ca = page.getByRole('table', { name: 'Budget 2027 mois par mois' }).getByRole('row', { name: /^Chiffre d’affaires HT/ })
  await expect(ca).toContainText(/600\s000\s€/)
  // Sans rythme mesuré, la base est l'atterrissage
  await expect(page.getByRole('region', { name: 'Base du CA' })).toContainText('Base : atterrissage 2026')

  await page.getByRole('button', { name: 'Prévoir un temps fort' }).click()
  const tf = page.getByRole('region', { name: 'Temps forts' })
  await tf.getByLabel('Nom du temps fort 1').fill('Oktoberfest')
  await expect(tf.getByLabel('Univers : Oktoberfest')).toHaveValue('exterieur')
  await expect(tf.getByLabel('Mois : Oktoberfest')).toHaveValue('6')
  // Extérieur : (60 000 − 12 000) / 60 % = 80 000, plus 15 000 en juin
  await tf.getByLabel('CA 2026 : Oktoberfest').fill('12 000')
  await tf.getByLabel('CA 2027 : Oktoberfest').fill('15 000')
  await expect(ca).toContainText(/595\s000\s€/)
  await expect(tf).toContainText(/CA 2026 retiré : 12\sk€ · CA 2027 ajouté : 15\sk€/)
  await tf.getByLabel('Extras de personnel : Oktoberfest').fill('800')
  await tf.getByLabel('Autres charges : Oktoberfest').fill('2 200')
  await expect(tf).toContainText(/Charges : 3\sk€/)

  // Une association gagnée : 1 000 € par mois toute l'année
  await page.getByRole('button', { name: 'Ajouter un client gagné ou perdu' }).click()
  const clients = page.getByRole('region', { name: 'Clients gagnés ou perdus' })
  await clients.getByLabel('Client ou événement 1').fill('Association sportive')
  await clients.getByLabel('Montant par mois : Association sportive').fill('1 000')
  await expect(ca).toContainText(/607\s000\s€/)
  await expect(clients).toContainText(/CA 2027 : \+12\s000\s€/)
  // En part du CA : − 10 % sur le Bar d'octobre à décembre (300 000 × 30 % × 10 %)
  await clients.getByLabel('Univers : Association sportive').selectOption('bar')
  await clients.getByLabel('Unité : Association sportive').selectOption('taux')
  await clients.getByLabel('De : Association sportive').selectOption('10')
  await clients.getByLabel('Part du CA : Association sportive').fill('-10')
  await expect(ca).toContainText(/586\s000\s€/)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-temps-forts.png`, fullPage: true })

  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés : le budget est en discussion avec le siège.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: unknown }
  expect(envoi.ajustements).toEqual({
    tempsForts: [{ nom: 'Oktoberfest', type: 'exterieur', mois: 6, univers: 'exterieur', caAnPasse: 12_000, ca: 15_000, extrasPersonnel: 800, autresCharges: 2_200, moisAchats: 5 }],
    ajustementsCA: [{ libelle: 'Association sportive', univers: 'bar', de: 10, a: 12, taux: -0.1 }],
  })
  // Retirer le temps fort : la carte revient au bouton
  await page.getByRole('button', { name: 'Retirer Oktoberfest' }).click()
  await expect(page.getByRole('button', { name: 'Prévoir un temps fort' })).toBeVisible()
})

test('le Directeur fixe la hausse tarifaire et les valeurs par ancienneté ; le budget du magasin les reprend', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { magasins: [magasin(magasinFictif)], ouvertures: [{ store_name: MAGASINS[0], ouverture: '2026-01-01' }] })
  await page.getByRole('link', { name: /Hypothèses/ }).click()
  const anciennete = page.getByRole('region', { name: 'Selon l’ancienneté du magasin' })
  await expect(anciennete.getByRole('row', { name: /^Année 2/ })).toContainText('1')
  const effet = page.getByRole('region', { name: 'Effet des hypothèses' })
  await expect(effet).toContainText(/600\sk€/)
  // Panier Cave : 2 % de hausse tarifaire ; tickets Cave + 5 % en année 2 → 200 000 × 1,05 × 1,02 + 400 000
  await page.getByLabel('Hausse tarifaire du réseau').fill('2')
  await expect(effet).toContainText(/604\sk€/)
  await page.getByLabel('Année 2 : évolution des tickets Cave').fill('5')
  await expect(effet).toContainText(/614\sk€/)
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  expect(await textesTropPetits(page)).toEqual([])
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Cibles enregistrées.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'cibles_reseau')?.corps).toEqual({ annee: 2027, valeur: { hausseTarifaire: 0.02, millesimes: { 2: { evolutionFlux: { cave: 0.05 } } } } })

  // Fiche du magasin : les tickets viennent de l'ancienneté, le panier de la hausse tarifaire
  await page.getByRole('link', { name: /Magasins/ }).first().click()
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const hypotheses = page.getByRole('table', { name: 'Hypothèses du magasin' })
  await expect(hypotheses.getByRole('row', { name: /^Tickets \(Cave\)/ })).toContainText('Ancienneté')
  await expect(hypotheses.getByRole('row', { name: /^Panier moyen TTC \(Cave\)/ })).toContainText('Tarif')
  await expect(page.getByLabel('Évolution du nombre de tickets : Cave')).toHaveAttribute('placeholder', '5')
})

test('paramètres réseau : achats de l’Extérieur payés avant la vente, opérations du réseau', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page, { role: 'directeur' })
  await page.getByRole('link', { name: /Paramètres/ }).first().click()
  const section = page.getByRole('region', { name: 'Trésorerie' })
  await expect(page.getByLabel('Avance des achats de l’Extérieur')).toHaveValue('1')
  await section.getByRole('button', { name: 'Ajouter une opération' }).click()
  await page.getByLabel('Nom de l’opération 1').fill('Foire aux vins')
  await page.getByLabel('Mois de vente : Foire aux vins').selectOption('9')
  await page.getByLabel('Achats payés en : Foire aux vins').selectOption('7')
  await page.getByLabel('Part des achats payée à l’avance : Foire aux vins').fill('50')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  expect(await textesTropPetits(page)).toEqual([])
  await section.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Paramètres de trésorerie 2027 enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { tresorerie: Record<string, unknown> } }
  expect(envoi.valeur.tresorerie).toMatchObject({ avanceExterieur: 1, operations: [{ nom: 'Foire aux vins', mois: 9, moisPaiement: 7, part: 0.5 }] })
})

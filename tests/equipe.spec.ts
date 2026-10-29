import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type PersonneSimulee } from './supabase-simule'

// Équipe et masse salariale : postes sans nom, coût chargé avec la réduction générale, effet sur le budget.
// Données fictives uniquement : dépôt public. Paramètres par défaut : employé 35 %, gérant TNS 33 %, SMIC 21 876,40 €.

const N = new Date().getFullYear()
const avecBase: MagasinSimule[] = [{ magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }]
const reseau = { hausseSalaires: 0.02 }
const equipe: PersonneSimulee[] = [
  { id: 1, store_name: MAGASINS[0], poste: 'Vendeur 1', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 1823.03, primes: [], entree: null, sortie: null },
  { id: 2, store_name: MAGASINS[0], poste: 'Gérant', categorie: 'gerant_tns', heures_hebdo: 45, brut_mensuel: 3000, primes: [], entree: null, sortie: null },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé ajoute un vendeur au SMIC : coût chargé, réduction générale et budget recalculé', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: avecBase, reseau })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  await expect(page.getByText('Pas encore d’équipe')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter un poste' }).click()
  const fiche = page.getByRole('region', { name: 'Nouveau poste' })
  await expect(fiche.getByLabel('Poste')).toHaveValue('Vendeur 1')
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(fiche.getByText('Le salaire brut mensuel est à renseigner.')).toBeVisible()
  await fiche.getByLabel('Brut mensuel').fill('1823,03')
  await fiche.getByRole('button', { name: 'Prime' }).click()
  await fiche.getByLabel('Montant de la prime 1').fill('')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-fiche-poste.png` })
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(page.getByText('Vendeur 1 enregistré dans l’équipe.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'equipe')?.corps).toEqual({
    store_name: MAGASINS[0], poste: 'Vendeur 1', categorie: 'employe', heures_hebdo: 35, heures_saisie: 'semaine', enveloppe: false, brut_mensuel: 1823.03, primes: [], entree: null, sortie: null,
  })
  // Au SMIC, la réduction couvre 33,77 points sur 35 : 21 876,36 × 1,0123 ; l'an prochain, + 2 % de salaires
  const ligne = page.getByRole('table', { name: 'Postes et coût chargé' }).getByRole('row', { name: /Vendeur 1/ })
  await expect(ligne).toContainText(/1,2\s%/)
  await expect(ligne).toContainText(/22\s145\s€/)
  await expect(ligne).toContainText(/22\s588\s€/)
  await expect(page.getByRole('region', { name: 'Masse salariale en chiffres' })).toContainText('Hausse des salaires : 2,0')
  await ouvrir(page, 'Résultat et trésorerie')
  await expect(page.getByRole('table', { name: 'Budget 2027 mois par mois' }).getByRole('row', { name: /^Frais de personnel/ })).toContainText(/22\s588\s€/)
})

test('le Directeur prévoit une prime et un départ, retire un poste ; le tableau suit', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: avecBase, reseau, equipe })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  const tableau = page.getByRole('table', { name: 'Postes et coût chargé' })
  // Gérant TNS : 3 000 × 12 × 1,33, sans réduction
  await expect(tableau.getByRole('row', { name: /Gérant/ })).toContainText(/47\s880\s€/)
  await expect(page.getByRole('region', { name: 'Masse salariale en chiffres' })).toContainText('2 postes')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-equipe.png`, fullPage: true })

  await page.getByRole('button', { name: 'Modifier Vendeur 1' }).click()
  const fiche = page.getByRole('region', { name: 'Modifier Vendeur 1' })
  await fiche.getByRole('button', { name: 'Prime' }).click()
  await fiche.getByLabel('Montant de la prime 1').fill('500')
  await fiche.getByLabel('Départ').click()
  await page.getByRole('option', { name: `juin ${N + 1}` }).click()
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(page.getByText('Vendeur 1 enregistré dans l’équipe.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'equipe' && e.methode === 'PATCH')
  expect(envoi?.filtre).toContain('id=eq.1')
  expect(envoi?.corps).toMatchObject({ primes: [{ mois: 12, montant: 500 }], sortie: `${N + 1}-06-01` })
  await expect(tableau.getByRole('row', { name: /Vendeur 1/ })).toContainText(`Jusqu’à juin ${N + 1}`)

  await page.getByRole('button', { name: 'Retirer Gérant' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Retirer' }).click()
  await expect(page.getByText('Gérant retiré de l’équipe.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'equipe' && e.methode === 'DELETE')?.filtre).toContain('id=eq.2')
  await expect(tableau.getByRole('row', { name: /Gérant/ })).toHaveCount(0)
})

test('le Directeur ajuste les taux de charges du réseau', async ({ page, isMobile }) => {
  const ecritures = await seConnecter(page)
  await page.getByRole('link', { name: /Paramètres/ }).click()
  const charges = page.getByRole('region', { name: 'Charges sociales' })
  await expect(charges.getByLabel('Charges patronales : Employé')).toHaveValue('35')
  await expect(charges.getByLabel('Réduction générale : taux dégressif')).toHaveValue('37,81')
  await expect(charges.getByLabel('SMIC annuel brut')).toHaveValue('21876,4')
  await charges.getByLabel('Charges patronales : Employé').fill('36,5')
  await charges.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText(/Charges sociales \d{4} enregistrées\./)).toBeVisible()
  const valeur = (ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { charges: { taux: Record<string, number>; reduction: Record<string, number> }; tauxRedevance: number } }).valeur
  expect(valeur.charges.taux.employe).toBe(0.365)
  expect(valeur.charges.reduction.smicAnnuel).toBe(21_876.4)
  expect(valeur.tauxRedevance).toBe(0.02)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('un Coach complète l’équipe d’un magasin de son périmètre', async ({ page }) => {
  const ecritures = await seConnecter(page, { role: 'coach', magasins: avecBase, reseau, equipe })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  await page.getByRole('button', { name: 'Ajouter un poste' }).click()
  const fiche = page.getByRole('region', { name: 'Nouveau poste' })
  await expect(fiche.getByLabel('Poste')).toHaveValue('Vendeur 2')
  await fiche.getByLabel('Heures par semaine').fill('24')
  await fiche.getByLabel('Brut mensuel').fill('1 250')
  await fiche.getByLabel('Arrivée').click()
  await page.getByRole('option', { name: `mars ${N + 1}` }).click()
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(page.getByText('Vendeur 2 enregistré dans l’équipe.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'equipe' && e.methode === 'POST')?.corps).toMatchObject({ heures_hebdo: 24, brut_mensuel: 1250, entree: `${N + 1}-03-01` })
  // Arrivée l'an prochain : rien cette année
  await expect(page.getByRole('table', { name: 'Postes et coût chargé' }).getByRole('row', { name: /Vendeur 2/ })).toContainText(/0\s€/)
})

test('primes d’équipe sans salarié, heures saisies au mois, productivité par heure travaillée', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: avecBase, reseau, equipe })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  // 35 h + 45 h par semaine, 52 semaines : 4 160 h ; CA 600 000 € ÷ 4 160 h = 144 € par heure
  const chiffres = page.getByRole('region', { name: 'Masse salariale en chiffres' })
  await expect(chiffres).toContainText(/144\s€ par heure/)
  await expect(chiffres).toContainText(/4\s160\sh/)

  await page.getByRole('button', { name: 'Primes d’équipe' }).click()
  const fiche = page.getByRole('region', { name: 'Primes d’équipe' })
  await expect(fiche.getByLabel('Heures par semaine')).toHaveCount(0)
  await expect(fiche.getByLabel('Brut mensuel')).toHaveCount(0)
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(fiche.getByText('Le montant d’au moins une prime est à renseigner.')).toBeVisible()
  await fiche.getByLabel('Montant de la prime 1').fill('1000')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-primes-equipe.png` })
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(page.getByText('Primes d’équipe : primes enregistrées dans l’équipe.')).toBeVisible()
  expect(ecritures.find((e) => e.table === 'equipe' && e.methode === 'POST')?.corps).toMatchObject({
    poste: 'Primes d’équipe', heures_hebdo: 0, brut_mensuel: 0, enveloppe: true, primes: [{ mois: 12, montant: 1000 }],
  })
  // 1 000 € chargés à 35 %, sans réduction générale ; les heures ne changent pas
  const tableau = page.getByRole('table', { name: 'Postes et coût chargé' })
  await expect(tableau.getByRole('row', { name: /Primes d’équipe/ })).toContainText('Sans salarié')
  await expect(tableau.getByRole('row', { name: /Primes d’équipe/ })).toContainText(/1\s350\s€/)
  await expect(chiffres).toContainText(/4\s160\sh/)

  // Vendeur 1 passe en heures par mois : 35 h par semaine = 151,7 h par mois ; 130 h par mois = 30 h par semaine
  await page.getByRole('button', { name: 'Modifier Vendeur 1' }).click()
  const vendeur = page.getByRole('region', { name: 'Modifier Vendeur 1' })
  await vendeur.getByRole('button', { name: 'Par mois' }).click()
  await expect(vendeur.getByLabel('Heures par mois')).toHaveValue(/^151,(6|7)/)
  await vendeur.getByLabel('Heures par mois').fill('130')
  await page.getByRole('region', { name: 'Changements non enregistrés' }).getByRole('button', { name: /^Enregistrer (le poste|les primes)$/ }).click()
  await expect(page.getByText('Vendeur 1 enregistré dans l’équipe.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'equipe' && e.methode === 'PATCH')?.corps as { heures_hebdo: number; heures_saisie: string }
  expect(envoi.heures_saisie).toBe('mois')
  expect(envoi.heures_hebdo).toBeCloseTo(30, 6)
  await expect(tableau.getByRole('row', { name: /Vendeur 1/ })).toContainText('130 h par mois')
})

test('extras : heures moyennes au mois et taux horaire, comme un poste ; comptés dans les heures travaillées', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: avecBase, reseau, equipe })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Équipe')
  await page.getByRole('button', { name: 'Extras', exact: true }).click()
  const fiche = page.getByRole('region', { name: /^Extras/ })
  await expect(fiche.getByLabel('Brut mensuel')).toHaveCount(0)
  await fiche.getByLabel('Heures d’extras par mois').fill('65')
  const barre = page.getByRole('region', { name: 'Changements non enregistrés' })
  await barre.getByRole('button', { name: 'Enregistrer le poste' }).click()
  await expect(fiche.getByText('Le taux horaire brut est à renseigner.')).toBeVisible()
  await fiche.getByLabel('Taux horaire brut').fill('12')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-extras.png` })
  await barre.getByRole('button', { name: 'Enregistrer le poste' }).click()
  await expect(page.getByText('Extras : extras enregistrés dans l’équipe.')).toBeVisible()
  // 65 h par mois = 15 h par semaine ; 65 h × 12 € = 780 € brut par mois
  const envoi = ecritures.find((e) => e.table === 'equipe' && e.methode === 'POST')?.corps as { heures_hebdo: number; brut_mensuel: number; taux_horaire: number; heures_saisie: string }
  expect(envoi).toMatchObject({ poste: 'Extras', categorie: 'employe', taux_horaire: 12, heures_saisie: 'mois' })
  expect(envoi.heures_hebdo).toBeCloseTo(15, 6)
  expect(envoi.brut_mensuel).toBeCloseTo(780, 6)
  const ligne = page.getByRole('table', { name: 'Postes et coût chargé' }).getByRole('row', { name: /^Extras/ })
  await expect(ligne).toContainText('65 h par mois')
  await expect(ligne).toContainText(/780\s€ \(12,00\s€ de l’heure\)/)
  // 4 160 h de l'équipe + 65 h × 12 mois
  await expect(page.getByRole('region', { name: 'Masse salariale en chiffres' })).toContainText(/4\s940\sh/)
})

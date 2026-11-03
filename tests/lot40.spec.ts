import { expect, test } from '@playwright/test'
import { MAGASINS, magasinFictif } from './donnees-fictives'
import { allerVers, COMPTE, ongletParametres, ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule } from './supabase-simule'
import { lignesFrais } from '../src/moteur/parametres'

// Lot 40 : grille des frais et règles de calcul modifiables depuis Paramètres réseau, appliquées partout.
// Données fictives uniquement : dépôt public.
const maintenant = new Date()
const aB = maintenant.getFullYear() + (maintenant.getMonth() >= 8 ? 1 : 0) // année budgétée, comme anneeBudget()
const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le Directeur renomme, masque et ajoute des lignes de la grille des frais, puis les retrouve au journal', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: [propose] })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Grille des frais')
  const section = page.getByRole('region', { name: 'Grille des frais' })
  const enregistrer = section.getByRole('button', { name: 'Enregistrer' })
  await expect(section).toContainText(`${lignesFrais.length} lignes`)
  await expect(section.getByText('Valeurs par défaut')).toBeVisible()
  await expect(enregistrer).toBeDisabled()

  await section.getByLabel('Libellé : Électricité, eau, gaz').fill('Électricité et eau')
  await section.getByLabel('Masquer la ligne : Carburant').click()
  // Compte déjà sur une autre ligne : refusé
  await section.getByLabel('Comptes du plan comptable : Électricité, eau, gaz').fill('6061, 6064')
  await expect(section.getByText('Le compte 6064 est sur deux lignes : Électricité et eau et Fournitures administratives.')).toBeVisible()
  await expect(enregistrer).toBeDisabled()
  await section.getByLabel('Comptes du plan comptable : Électricité, eau, gaz').fill('6061, 6062')
  // Nouvelle ligne, rangée dans son thème
  const ajout = page.getByRole('region', { name: 'Ajouter une ligne de frais' })
  await ajout.getByLabel('Libellé de la nouvelle ligne').fill('Musique d’ambiance')
  await ajout.getByLabel('Thème de la nouvelle ligne').selectOption({ label: 'Communication' })
  await ajout.getByRole('button', { name: 'Ajouter' }).click()
  await expect(section.getByRole('region', { name: 'Thème : Communication' }).getByRole('group')).toHaveCount(3)
  await section.getByLabel('Comptes du plan comptable : Musique d’ambiance').fill('6237')
  // Une saisie en cours bloque le changement d'année
  await expect(page.getByRole('group', { name: 'Année des paramètres' }).getByRole('button').first()).toBeDisabled()
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot40-grille.png`, fullPage: true })
  await enregistrer.click()
  await expect(page.getByText(`Grille des frais ${aB} enregistrée.`)).toBeVisible()

  const ecrite = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { grilleFrais: { code: string; libelle: string; racines: string[]; masquee?: boolean; rubrique: string }[] } }
  const g = ecrite.valeur.grilleFrais
  expect(g.find((l) => l.code === 'energie')).toMatchObject({ libelle: 'Électricité et eau', racines: ['6061', '6062'] })
  expect(g.find((l) => l.code === 'carburant')?.masquee).toBe(true)
  expect(g.find((l) => l.libelle === 'Musique d’ambiance')).toMatchObject({ code: 'ajout_musique_d_ambiance', rubrique: 'communication', racines: ['6237'] })
  expect(Object.keys(ecrite.valeur)).not.toContain('regles')

  await ongletParametres(page, 'Journal')
  await expect(page.getByRole('row', { name: /Grille des frais/ })).toContainText('4 changements')
  await expect(page.getByRole('row', { name: /Grille des frais/ })).toContainText(COMPTE.email)
})

test('le Directeur règle les seuils de calcul ; hors bornes, l’enregistrement est refusé', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { magasins: [propose] })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Règles de calcul')
  const section = page.getByRole('region', { name: 'Règles de calcul' })
  const enregistrer = section.getByRole('button', { name: 'Enregistrer' })
  const jeune = section.getByLabel('Magasin en montée en charge tant qu’il a moins de')
  await expect(jeune).toHaveValue('18')
  await expect(section.getByLabel('Rythme récent suivi d’office tant qu’il s’écarte de moins de')).toHaveValue('15')
  await jeune.fill('40')
  await expect(section.getByText('Magasin en montée en charge tant qu’il a moins de : de 6 à 36, nombre entier.')).toBeVisible()
  await expect(enregistrer).toBeDisabled()
  await jeune.fill('24')
  await section.getByLabel('Rythme récent suivi d’office tant qu’il s’écarte de moins de').fill('20')
  await section.getByLabel('Tickets et panier comparés à l’an dernier sur les derniers').fill('2')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot40-regles.png`, fullPage: true })
  await enregistrer.click()
  await expect(page.getByText(`Règles de calcul ${aB} enregistrées.`)).toBeVisible()
  const ecrite = ecritures.find((e) => e.table === 'parametres_reseau')?.corps as { valeur: { regles: Record<string, number>; grilleFrais?: unknown } }
  expect(ecrite.valeur.regles).toMatchObject({ jeuneMagasin: 24, ecartRythme: 0.2, moisRythme: 4, moisCommerciaux: 2 })
  expect(ecrite.valeur.grilleFrais).toBeUndefined()
  await ongletParametres(page, 'Journal')
  await expect(page.getByRole('row', { name: /Règles de calcul/ })).toContainText(/montée en charge \(mois\) : 18 → 24 ; écart du rythme suivi d’office : 15,0\s% → 20,0\s% ; mois des alertes tickets et panier : 3 → 2/)
  // Le seuil des alertes tickets et panier suit la règle
  await ongletParametres(page, 'Alertes et campagne')
  await expect(page.getByText('Tickets des 2 derniers mois sous ceux de l’an dernier', { exact: false })).toBeVisible()
})

test('un Responsable Régional consulte la grille et les règles sans pouvoir les modifier', async ({ page, isMobile }) => {
  await seConnecter(page, { role: 'rr', magasins: [propose] })
  await allerVers(page, 'Paramètres réseau')
  await ongletParametres(page, 'Grille des frais')
  await expect(page.getByLabel('Libellé : Locations immobilières')).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Ajouter une ligne de frais' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0)
  await ongletParametres(page, 'Règles de calcul')
  await expect(page.getByLabel('Magasin en montée en charge tant qu’il a moins de')).toBeDisabled()
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
})

test('les frais du magasin suivent la grille du réseau : libellé renommé, ligne masquée plus proposée, ligne ajoutée', async ({ page, isMobile }) => {
  const energie: FraisSimule = { store_name: MAGASINS[0], code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies', annuel: 6_000, taux_ca: null }
  const grilleFrais = [
    ...lignesFrais.map((l) => (l.code === 'energie' ? { ...l, libelle: 'Électricité et eau' } : l.code === 'carburant' ? { ...l, masquee: true } : l)),
    { code: 'ajout_musique', libelle: 'Musique d’ambiance', rubrique: 'energies', bloc: 'charges_externes', racines: [] },
  ]
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [propose], frais: [energie], parametres: { tauxRedevance: 0.02, tauxPublicite: 0.01, grilleFrais } })
  await ouvrir(page, 'Frais')
  await expect(page.getByLabel('Électricité et eau', { exact: true })).toHaveValue('6 000')
  await page.getByRole('button', { name: 'Ajouter une ligne : Énergies' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toContainText('Musique d’ambiance')
  await expect(menu).not.toContainText('Carburant')
  await menu.getByRole('menuitem', { name: 'Musique d’ambiance' }).click()
  await page.getByLabel('Musique d’ambiance', { exact: true }).fill('1 200')
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('button', { name: 'Enregistrer les frais' }).click()
  await expect(page.getByText('Frais enregistrés.')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'frais' && e.methode === 'POST')?.corps as FraisSimule[]
  expect(envoi.find((l) => l.code === 'energie')?.libelle).toBe('Électricité et eau')
  expect(envoi.find((l) => l.code === 'ajout_musique')).toMatchObject({ libelle: 'Musique d’ambiance', annuel: 1_200 })
})

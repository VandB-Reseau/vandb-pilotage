import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type ActionSimulee, type MagasinSimule } from './supabase-simule'

// Lot 27, sprint ergonomie : fiche en trois espaces, barre d'enregistrement, compte de résultat par période,
// trésorerie en barres, liste des magasins triable, « À traiter ». Données fictives uniquement : dépôt public.

const propose: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: '2026-10-20T09:30:00Z' }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('fiche en trois espaces ; la barre d’enregistrement montre l’effet avant → après et se retire à l’annulation', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [propose] })
  const espaces = page.getByRole('tablist', { name: 'Vues du magasin' })
  await expect(espaces.getByRole('tab')).toHaveText(['Synthèse', /^\d{4} en cours/, /^Budget \d{4}/])
  await espaces.getByRole('tab', { name: /^Budget/ }).click()
  const parties = page.getByRole('tablist', { name: /^Parties du budget/ })
  await expect(parties.getByRole('tab', { name: '1 · Chiffre d’affaires' })).toHaveAttribute('aria-selected', 'true')
  await expect(parties.getByRole('tab')).toHaveCount(4)

  const barre = page.getByRole('region', { name: 'Changements non enregistrés' })
  await expect(barre).toHaveCount(0)
  // 200 000 € de Cave × 1,05 : + 10 000 € de CA (tests/budget.spec.ts)
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  await expect(barre).toBeVisible()
  await expect(barre).toContainText('1 changement')
  await expect(barre).toContainText(/CA\s600\sk€\s→\s610\sk€/)
  await expect(barre).toContainText('Trésorerie fin décembre')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-barre-enregistrement.png` })

  // Passer d'une partie du budget à l'autre garde la saisie
  await ouvrir(page, 'Résultat et trésorerie')
  await expect(barre).toContainText('1 changement')
  await barre.getByRole('button', { name: 'Annuler les changements' }).click()
  await expect(barre).toHaveCount(0)
  await ouvrir(page, 'Hypothèses')
  await expect(page.getByLabel('Évolution du nombre de tickets : Cave')).toHaveValue('')
})

test('compte de résultat par quadrimestre en milliers d’euros ; trésorerie en barres avec la plus grosse sortie', async ({ page, isMobile }, info) => {
  await seConnecter(page, { magasins: [propose] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat et trésorerie')
  const annee = Number((await page.getByRole('tab', { name: /^Budget/ }).first().textContent())?.match(/\d{4}/)?.[0])
  const tableau = page.getByRole('table', { name: `Budget ${annee} mois par mois` })
  await expect(tableau.getByRole('columnheader')).toHaveCount(15)            // libellé, 12 mois, total, part du CA

  await page.getByRole('group', { name: 'Période : compte de résultat' }).getByRole('button', { name: 'Quadrimestres' }).click()
  await page.getByRole('group', { name: 'Unité : compte de résultat' }).getByRole('button', { name: 'En milliers d’euros' }).click()
  await expect(tableau.getByRole('columnheader')).toHaveText(['En k€', 'Janv. – avr.', 'Mai – août', 'Sept. – déc.', 'Total', '% du CA'])
  // CA 600 000 € : 600 k€ sur l'année
  await expect(tableau.getByRole('row', { name: /^Chiffre d’affaires HT/ }).getByRole('cell').nth(-2)).toHaveText('600')
  await page.getByRole('group', { name: 'Période : compte de résultat' }).getByRole('button', { name: 'Année' }).click()
  await expect(tableau.getByRole('columnheader')).toHaveText(['En k€', 'Total', '% du CA'])

  // Trésorerie : une barre par fin de mois, l'infobulle détaille le mois
  const graphique = page.getByRole('img', { name: new RegExp(`^Trésorerie de fin de mois ${annee} : point bas`) })
  await expect(graphique).toBeVisible()
  await page.locator('[data-mois="1"]').last().click()
  const bulle = page.getByRole('tooltip')
  await expect(bulle).toContainText('Fin janvier')
  await expect(bulle).toContainText('Encaissements')
  await expect(bulle).toContainText(/Dont /)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-resultat-tresorerie.png`, fullPage: true })

  // Le choix de période est gardé dans le navigateur
  await page.reload()
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Résultat et trésorerie')
  await expect(page.getByRole('table', { name: `Budget ${annee} mois par mois` }).getByRole('columnheader')).toHaveText(['En k€', 'Total', '% du CA'])
})

test('liste des magasins : tri par colonne, ligne Total, alertes, sans colonne Groupe vide', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'tableau du PC ; le téléphone garde ses cartes')
  await seConnecter(page)
  const tableau = page.getByRole('table', { name: /^Budgets \d+ par magasin$/ })
  await expect(tableau.getByRole('columnheader', { name: 'Groupe' })).toHaveCount(0)
  const lignes = tableau.getByRole('row')
  // Deux budgets : 640 000 € (validé) et 640 000 € à évolution nulle (en discussion)
  await expect(lignes.nth(1)).toContainText('Total de la sélection')
  await expect(lignes.nth(1)).toContainText('2 budgets')
  await expect(tableau.getByRole('columnheader', { name: 'Alertes' })).toBeVisible()

  await tableau.getByRole('button', { name: 'CA HT' }).click()
  expect(page.url()).toContain('tri=ca')
  expect(page.url()).toContain('sens=desc')
  await expect(lignes.nth(4)).toContainText(MAGASINS[2])                    // sans budget : toujours en bas
  await tableau.getByRole('button', { name: 'Magasin' }).click()
  await expect(lignes.nth(2)).toContainText([...MAGASINS].slice(0, 3).sort((a, b) => a.localeCompare(b, 'fr'))[0])
  await tableau.getByRole('button', { name: 'Magasin' }).click()
  await expect(lignes.nth(4)).toContainText([...MAGASINS].slice(0, 3).sort((a, b) => a.localeCompare(b, 'fr'))[0])
  expect(await textesTropPetits(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-liste-magasins.png`, fullPage: true })
})

test('« À traiter » : budget à proposer, en discussion, action en retard ; jamais pour le franchisé', async ({ page, isMobile }, info) => {
  const enRetard: ActionSimulee = {
    id: 1, store_name: MAGASINS[1], type_alerte: 'ca', intitule: 'Relancer la vente additionnelle', responsable: 'franchise', echeance: '2020-01-31', statut: 'a_faire',
    annee: 2026, depart: null, mois_depart: null, cree_par_role: 'coach', cree_par_nom: 'Coach Nord', cree_le: '2020-01-02T09:00:00Z', faite_le: null,
  }
  await seConnecter(page, { actions: [enRetard] })
  const bloc = page.getByRole('region', { name: 'À traiter' })
  const points = bloc.getByRole('listitem')
  await expect(points.filter({ hasText: 'action du plan en retard' })).toContainText(MAGASINS[1])
  await expect(points.filter({ hasText: /budget \d+ à proposer/ })).toHaveCount(1)
  await expect(points.filter({ hasText: 'budget en discussion : à valider ou à reprendre' })).toHaveCount(1)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-a-traiter.png`, fullPage: true })

  // « Afficher ces magasins » filtre la liste
  await points.filter({ hasText: 'budget en discussion' }).getByRole('button', { name: /^Afficher ces magasins/ }).click()
  await expect(page.getByRole('group', { name: 'Filtres' }).getByRole('button', { name: /^En discussion/ })).toHaveAttribute('aria-pressed', 'true')

  // Replié, le choix est gardé
  await bloc.getByRole('button', { name: 'Replier' }).click()
  await expect(points.first()).toBeHidden()
  await page.reload()
  await expect(page.getByRole('region', { name: 'À traiter' }).getByRole('button', { name: /^Voir les \d+ points$/ })).toBeVisible()
})

test('« À traiter » : le Coach n’a pas de budget à proposer, mais voit l’équipe à renseigner', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [{ ...propose, statut: 'valide' }], equipe: [], frais: [] })
  const bloc = page.getByRole('region', { name: 'À traiter' })
  await expect(bloc.getByRole('listitem').filter({ hasText: 'à proposer' })).toHaveCount(0)
  await expect(bloc.getByRole('listitem').filter({ hasText: 'équipe à renseigner' })).toHaveCount(1)
})

test('« À traiter » absent pour le franchisé', async ({ page }) => {
  await seConnecter(page, { role: 'franchise' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'À traiter' })).toHaveCount(0)
})

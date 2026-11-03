import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule } from './supabase-simule'

// Lot 43 (Joseph, 03/11/2026) : campagne des budgets selon le rôle, bandeau unique de la liste des magasins, trésorerie
// au 1er janvier au point de départ, hausse des salaires et inflation des frais à un seul endroit, état des étapes dans
// le menu. Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
const budget = (magasin: string, statut: MagasinSimule['statut'], s: Partial<MagasinSimule> = {}): MagasinSimule =>
  statut ? { magasin, statut, hypotheses: magasinFictif, base: magasinFictif, maj_le: ilYa(1), ajustements: {}, ajustements_siege: {}, ...s }
    : { magasin, statut: null, hypotheses: null, maj_le: null }
// Campagne passée : propositions attendues depuis longtemps, validation à venir ; le budget non proposé est en retard
const campagne = { proposition: '2020-01-01', retour: '2099-01-01', validation: '2099-01-02' }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('Directeur : la campagne par étape et par Responsable Régional, dépliée sur les Coachs ; un chiffre filtre la liste', async ({ page, isMobile }, info) => {
  await seConnecter(page, {
    parametres: { campagne },
    magasins: [budget(MAGASINS[0], null), budget(MAGASINS[1], 'propose'), budget(MAGASINS[2], 'valide')],
    rrs: { [MAGASINS[0]]: ['RR Nord'], [MAGASINS[1]]: ['RR Nord'], [MAGASINS[2]]: ['RR Sud'] },
    coachs: { [MAGASINS[0]]: 'Coach Alpha', [MAGASINS[1]]: 'Coach Bêta', [MAGASINS[2]]: 'Coach Bêta' },
  })
  const bandeau = page.getByRole('region', { name: `Campagne des budgets ${N + 1}` })
  await expect(bandeau).toContainText('1 validé sur 3')
  await expect(bandeau).toContainText('1 en retard')
  // Allègement (03/11/2026) : une seule rangée de filtres sous le bandeau porte les étapes
  await expect(bandeau.getByRole('group', { name: 'Étapes de la campagne' })).toHaveCount(0)
  const etapes = page.getByRole('group', { name: 'Filtres' })
  for (const n of ['Tous · 3', 'À proposer · 1', 'Chez le franchisé · 1', 'Validés · 1', 'En retard · 1']) await expect(etapes.getByRole('button', { name: n })).toBeVisible()
  // Les anciens blocs séparés ne sont plus là
  await expect(page.getByRole('region', { name: `Budgets ${N + 1} en chiffres` })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Proposer en série' })).toHaveCount(0)

  await bandeau.getByRole('button', { name: 'Par Responsable Régional' }).click()
  const parRR = bandeau.getByRole('table', { name: 'Par Responsable Régional' })
  await expect(parRR.getByRole('row', { name: /^RR Nord/ }).getByRole('cell')).toHaveText(['RR Nord', '2', '1', '1', '0', '0', '1'])
  await parRR.getByRole('button', { name: 'Voir les Coachs de RR Nord' }).click()
  await expect(parRR.getByRole('row', { name: /^Coach Alpha/ }).getByRole('cell')).toHaveText(['Coach Alpha', '1', '1', '0', '0', '0', '1'])
  await expect(parRR.getByRole('row', { name: /^Coach Bêta/ }).getByRole('cell')).toHaveText(['Coach Bêta', '1', '0', '1', '0', '0', '0'])
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot43-campagne-directeur.png`, fullPage: true })

  // Le chiffre « chez le franchisé » de Coach Bêta : la liste ne montre que son magasin chez le franchisé
  await parRR.getByRole('button', { name: '1 : chez le franchisé, Coach Bêta' }).click()
  const filtres = page.getByRole('group', { name: 'Filtres' })
  await expect(filtres.getByRole('button', { name: /^Chez le franchisé · 1/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(filtres).toContainText('Coach Bêta')
  if (!isMobile) {
    const lignes = page.getByRole('table', { name: /Budgets .* par magasin/ }).getByRole('row').filter({ has: page.getByRole('link') })
    await expect(lignes).toHaveCount(1)
    await expect(lignes.first()).toContainText(MAGASINS[1])
  }
  await filtres.getByLabel('Retirer le filtre : Coach Bêta').click()
  await expect(filtres).not.toContainText('Coach Bêta')

  // « En retard » : le magasin sans budget
  await etapes.getByRole('button', { name: 'En retard · 1' }).click()
  await expect(filtres.getByRole('button', { name: /^En retard · 1/ })).toHaveAttribute('aria-pressed', 'true')

  // Proposer en série : un bouton du bandeau ouvre le panneau
  await bandeau.getByRole('button', { name: 'Proposer en série' }).click()
  await expect(page.getByRole('region', { name: 'Proposer en série' })).toBeVisible()
})

test('Coach : ses magasins un par un, l’étape, les jours d’attente et l’EBE', async ({ page, isMobile }, info) => {
  await seConnecter(page, {
    role: 'coach', parametres: { campagne },
    magasins: [
      budget(MAGASINS[0], 'propose', { maj_le: ilYa(12) }),
      budget(MAGASINS[1], 'en_discussion', { maj_le: ilYa(1), envoye_le: ilYa(3), ajustements: { evolutionFlux: { cave: 0.05 } } }),
      budget(MAGASINS[2], null),
    ],
    coachs: { [MAGASINS[0]]: 'Coach Alpha', [MAGASINS[1]]: 'Coach Alpha', [MAGASINS[2]]: 'Coach Alpha' },
  })
  const bandeau = page.getByRole('region', { name: `Campagne des budgets ${N + 1}` })
  await bandeau.getByRole('button', { name: 'Mes magasins, jours d’attente' }).click()
  const mes = bandeau.getByRole('table', { name: 'Mes magasins' })
  const lignes = mes.getByRole('row').filter({ has: page.getByRole('link') })
  // En retard d'abord, puis l'attente la plus longue
  await expect(lignes.nth(0)).toContainText(MAGASINS[2])
  await expect(lignes.nth(0)).toContainText('En retard')
  await expect(lignes.nth(1)).toContainText(MAGASINS[0])
  await expect(lignes.nth(1)).toContainText('Chez le franchisé')
  await expect(lignes.nth(1)).toContainText('12 jours')
  await expect(lignes.nth(2)).toContainText('Retour du franchisé')
  await expect(lignes.nth(2)).toContainText('3 jours')
  // Retour du franchisé : son EBE (+ 5 % de tickets Cave) diffère de celui proposé
  const ebe = await lignes.nth(2).getByRole('cell').allTextContents()
  expect(ebe[3]).not.toBe('')
  expect(ebe[4]).not.toBe(ebe[3])
  // Le Coach ne voit pas de tableau par Coach (une seule ligne, la sienne) ni de bouton de proposition
  await expect(bandeau.getByRole('table', { name: 'Par Coach' })).toHaveCount(0)
  await expect(bandeau.getByRole('button', { name: 'Proposer en série' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot43-campagne-coach.png`, fullPage: true })
})

test('Responsable Régional : par Coach, et « Valider en série » quand un budget revient sans changement', async ({ page }) => {
  await seConnecter(page, {
    role: 'rr', parametres: { campagne },
    magasins: [
      budget(MAGASINS[0], 'en_discussion', { envoye_le: ilYa(2) }),
      budget(MAGASINS[1], 'propose'),
    ],
    rrs: { [MAGASINS[0]]: ['RR Nord'], [MAGASINS[1]]: ['RR Nord'] },
    coachs: { [MAGASINS[0]]: 'Coach Alpha', [MAGASINS[1]]: 'Coach Bêta' },
  })
  const bandeau = page.getByRole('region', { name: `Campagne des budgets ${N + 1}` })
  await bandeau.getByRole('button', { name: 'Par Coach' }).click()
  await expect(bandeau.getByRole('table', { name: 'Par Coach' }).getByRole('row', { name: /^Coach Alpha/ }).getByRole('cell')).toHaveText(['Coach Alpha', '1', '0', '0', '1', '0', '0'])
  await expect(page.getByRole('region', { name: 'Budgets prêts à valider' })).toHaveCount(0)
  await bandeau.getByRole('button', { name: 'Valider en série · 1' }).click()
  await expect(page.getByRole('region', { name: 'Budgets prêts à valider' })).toContainText('1 budget prêt à valider')
})

test('trésorerie au 1er janvier au point de départ ; hausse des salaires et inflation des frais dans Construire seulement', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [budget(MAGASINS[0], 'propose')] })
  await ouvrir(page, 'Point de départ')
  const depart = page.getByRole('region', { name: `Trésorerie au 1er janvier ${N + 1}` })
  await depart.getByLabel('Trésorerie au 1er janvier', { exact: true }).fill('20000')
  await expect(depart).toContainText(`Fin décembre ${N + 1}`)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-lot43-depart.png`, fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les ajustements' }).click()
  await expect(page.getByText('Ajustements enregistrés. Envoie-les au siège quand ils sont prêts (étape 3).')).toBeVisible()
  const envoi = ecritures.find((e) => e.table === 'budgets' && e.methode === 'PATCH')?.corps as { ajustements: Record<string, unknown> }
  expect(envoi.ajustements.tresorerieDepart).toBe(20_000)

  await ouvrir(page, 'Construire')
  const main = page.locator('main')
  // Plus de carte Trésorerie : le plan se lit sous le résultat, la trésorerie de départ y renvoie
  await expect(main.getByRole('region', { name: 'Trésorerie', exact: true })).toHaveCount(0)
  await expect(main.getByLabel('Trésorerie au 1er janvier', { exact: true })).toHaveCount(0)
  await expect(main.getByLabel('Trésorerie de départ')).toContainText(/Au 1er janvier : 20\sk€/)
  // Salaires et frais (03/11/2026) : chacun dans son thème, avec son effet ; plus de tableau commun sur Construire
  await expect(main.getByRole('table', { name: `Hypothèses ${N + 1} : salaires et frais` })).toHaveCount(0)
  await ouvrir(page, 'Équipe')
  const sal = page.locator('main').getByRole('table', { name: `Hypothèses ${N + 1} : salaires` })
  await expect(sal.getByRole('row', { name: /^Hausse générale des salaires/ })).toBeVisible()
  if (!isMobile) await expect(sal.getByRole('columnheader', { name: 'Effet' })).toBeVisible()
  await main.getByRole('link', { name: 'Toutes les hypothèses' }).click()
  await main.getByRole('region', { name: 'Frais', exact: true }).getByRole('link').click()
  await expect(page.locator('main').getByRole('table', { name: `Hypothèses ${N + 1} : frais` }).getByRole('row', { name: /^Inflation des frais/ })).toBeVisible()
  // L'ancienne adresse du thème Trésorerie mène au point de départ
  await page.goto(`./#/magasins/${encodeURIComponent(MAGASINS[0])}/tresoBudget`)
  await expect(page).toHaveURL(/\/depart$/)
})

test('budget pas encore proposé : la trésorerie au 1er janvier se lit, estimée, sans champ', async ({ page }) => {
  await seConnecter(page, { role: 'directeur', magasins: [budget(MAGASINS[0], null)] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Point de départ')
  const depart = page.getByRole('region', { name: `Trésorerie au 1er janvier ${N + 1}` })
  await expect(depart).toBeVisible()
  await expect(depart.getByLabel('Trésorerie au 1er janvier', { exact: true })).toHaveCount(0)
})

test('étapes du budget : l’état de chaque étape selon qui regarde', async ({ page }) => {
  await seConnecter(page, { role: 'franchise', magasins: [budget(MAGASINS[0], 'propose')] })
  await ouvrir(page, 'Ventes')
  // 03/11/2026 : dans les onglets de la fiche, sur PC comme sur téléphone
  const menu = page.getByRole('navigation', { name: 'Pages du magasin' })
  await expect(menu.getByRole('tab', { name: /^0 · Point de départ/ })).toContainText('Fait')
  await expect(menu.getByRole('tab', { name: /^1 · Construire/ })).toContainText('À relire')
  await expect(menu.getByRole('tab', { name: /^2 · Envoyer et valider/ })).toContainText('À envoyer')
  await page.getByLabel('Évolution du nombre de tickets : Cave').fill('5')
  await expect(menu.getByRole('tab', { name: /^1 · Construire/ })).toContainText('Non enregistré')
})

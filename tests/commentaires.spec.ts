import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type MessageSimule, type VersionSimulee } from './supabase-simule'

// Commentaires sur le budget (Joseph, 03/11/2026) : posés sur un point précis comme dans un document partagé, avec des
// réponses et « Résolu », présents sur les trois étapes ; l'historique des versions reste à l'étape 3. Données fictives.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0) // année du budget, comme l'app
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Un message d'avant les commentaires : il devient un commentaire sur le budget en général
const ancien: MessageSimule = {
  id: 1, store_name: MAGASINS[0], annee: B, sujet: 'ca', texte: 'Proposition : +5 % sur la bière, en ligne avec le réseau.',
  auteur: '00000000-0000-0000-0000-0000000000dd', auteur_role: 'directeur', auteur_nom: null, cree_le: `${N}-10-20T09:30:00Z`,
}
// Le franchisé ajuste les tickets de la Cave à −5 % : la bière pèse 120/360 des 600 000 € de CA, soit 200 000 € ; −10 000 € de CA à
// 36 % de marge (−3 600 €), moins redevance, publicité et énergie qui suivent le CA (4,3 % × 10 000 = −430 €) : EBE −3 170 €
const versions: VersionSimulee[] = [
  { id: 1, store_name: MAGASINS[0], annee: B, statut: 'propose', base: magasinFictif, ajustements: {}, auteur_role: 'directeur', auteur_nom: null, cree_le: `${N}-10-20T09:00:00Z` },
  { id: 2, store_name: MAGASINS[0], annee: B, statut: 'en_discussion', base: magasinFictif, ajustements: { evolutionFlux: { cave: -0.05 } }, auteur_role: 'franchise', auteur_nom: 'Franchise Test', cree_le: `${N}-10-22T16:05:00Z` },
]

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé commente une hypothèse, le siège répond, le point est résolu ; l’ancien message reste', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin], messages: [ancien], versions })
  await ouvrir(page, 'Ventes')
  const panneau = page.getByRole('region', { name: 'Commentaires', exact: true })
  // L'ancien message : un commentaire ouvert sur le budget en général
  await expect(panneau).toContainText('1 ouvert')
  const fils = panneau.getByRole('listitem').filter({ hasText: 'Proposition : +5 %' })
  await expect(fils).toHaveAccessibleName('Commentaire sur Le budget en général')
  await expect(fils).toContainText('Directeur de réseau')
  await expect(fils.getByRole('button', { name: 'Retirer mon commentaire' })).toHaveCount(0)

  // La bulle de la ligne « tickets » de la Cave : le panneau se règle sur ce point
  const ligne = page.getByRole('row').filter({ has: page.getByLabel('Évolution du nombre de tickets : Cave', { exact: true }) })
  await ligne.getByRole('button', { name: 'Commenter cette ligne' }).click()
  await expect(panneau).toContainText('Sur : Évolution du nombre de tickets : Cave')
  await expect(panneau).toContainText('Aucun commentaire sur ce point.')
  const champ = panneau.getByRole('textbox', { name: 'Commenter : Évolution du nombre de tickets : Cave' })
  await expect(champ).toBeFocused()
  await champ.fill('La bière stagne depuis l’été : je préfère −5 % de tickets.')
  await panneau.getByRole('button', { name: 'Commenter', exact: true }).click()
  await expect(champ).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'echanges_budget' && e.methode === 'POST')?.corps).toEqual({
    store_name: MAGASINS[0], annee: B, texte: 'La bière stagne depuis l’été : je préfère −5 % de tickets.',
    ancre: 'ligne/flux/cave', ancre_libelle: 'Évolution du nombre de tickets : Cave',
  })
  const mien = panneau.getByRole('listitem').filter({ hasText: 'La bière stagne' })
  await expect(mien).toContainText('Franchise Test, Franchisé')
  // La bulle compte le commentaire ouvert ; « Tout voir » remet les deux
  await expect(ligne.getByRole('button', { name: 'Commentaires sur cette ligne (1 ouvert)' })).toBeVisible()
  await panneau.getByRole('button', { name: 'Tout voir' }).click()
  await expect(panneau).toContainText('2 ouverts')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await panneau.screenshot({ path: `captures/${info.project.name}-commentaires.png` })

  // Réponse sous le commentaire, puis « Résolu » : il passe dans les résolus, la bulle se vide
  await mien.getByRole('button', { name: 'Répondre' }).click()
  await mien.getByRole('textbox', { name: 'Ta réponse' }).fill('Je garde −5 %, on en reparle en mars.')
  await mien.getByRole('button', { name: 'Répondre' }).click()
  await expect(mien).toContainText('Je garde −5 %, on en reparle en mars.')
  expect(ecritures.filter((e) => e.table === 'echanges_budget' && e.methode === 'POST').at(-1)?.corps).toMatchObject({ parent: 2, texte: 'Je garde −5 %, on en reparle en mars.' })
  await mien.getByRole('button', { name: 'Résolu' }).click()
  expect(ecritures.find((e) => e.table === 'rpc/resoudre_commentaire')?.corps).toEqual({ p_id: 2, p_resolu: true })
  await expect(panneau).toContainText('1 ouvert')
  await expect(ligne.getByRole('button', { name: 'Commenter cette ligne' })).toBeVisible()
  await panneau.getByRole('button', { name: 'Voir le résolu' }).click()
  await expect(panneau.getByRole('listitem').filter({ hasText: 'La bière stagne' }).first()).toContainText('Résolu par Franchise Test, Franchisé')
})

test('les commentaires suivent les trois étapes ; à l’étape 3, l’historique des versions et l’avertissement avant de valider', async ({ page, isMobile }) => {
  await seConnecter(page, {
    magasins: [{ ...magasin, ajustements: { evolutionFlux: { cave: -0.05 } }, ajustements_siege: {}, envoye_le: `${N}-10-22T16:05:00Z` }],
    messages: [ancien], versions,
  })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  const panneau = page.getByRole('region', { name: 'Commentaires', exact: true })
  // Sur une carte de « Construire »
  await ouvrir(page, 'Construire')
  await expect(panneau).toBeVisible()
  await page.getByRole('region', { name: 'Investissements & Financements', exact: true }).getByRole('button', { name: 'Commenter : Investissements & Financements' }).click()
  await expect(panneau).toContainText('Sur : Investissements & Financements')
  // Sur « Visualiser »
  await ouvrir(page, 'Visualiser')
  await page.getByRole('button', { name: `Commenter : Résultat et trésorerie ${B}` }).click()
  await panneau.getByRole('textbox', { name: `Commenter : Résultat et trésorerie ${B}` }).fill('Le point bas de trésorerie est en janvier, à surveiller.')
  await panneau.getByRole('button', { name: 'Commenter', exact: true }).click()
  await expect(panneau.getByRole('listitem')).toHaveCount(1)

  // Étape 3 : versions de la plus récente à la plus ancienne, avertissement des commentaires ouverts, validation possible
  await ouvrir(page, 'Envoyer et valider')
  await expect(panneau).toContainText('2 ouverts')
  const lignes = page.getByRole('table', { name: `Versions du budget ${B}` }).getByRole('row')
  await expect(lignes).toHaveCount(3)
  await expect(lignes.nth(1)).toContainText('Franchisé · Franchise Test')
  await expect(lignes.nth(1).getByRole('cell').last()).toContainText(/[−-]3\s170/)
  await expect(lignes.nth(2)).toContainText('Proposé par le siège')
  const revue = page.getByRole('region', { name: 'Ce que le magasin a changé' })
  await expect(revue).toContainText('2 commentaires sont encore ouverts.')
  await expect(page.getByRole('region', { name: 'Échanges sur le budget' })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await revue.getByRole('button', { name: 'Valider le budget' }).click()
  await expect(page.getByText(`Budget ${B} validé.`)).toBeVisible()
})

test('le Coach commente aussi ; sans commentaire, le panneau dit comment faire ; ailleurs que dans le budget, pas de panneau', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [magasin] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('region', { name: 'Commentaires', exact: true })).toHaveCount(0)   // Suivi
  await ouvrir(page, 'Envoyer et valider')
  const panneau = page.getByRole('region', { name: 'Commentaires', exact: true })
  await expect(panneau).toContainText('Aucun commentaire. Pour commenter un point précis, clique sur la bulle à côté de lui.')
  await expect(page.getByRole('region', { name: 'Historique du budget' })).toHaveCount(0)
  await panneau.getByRole('textbox', { name: 'Commenter : Le budget en général' }).fill('On en parle à ma visite de jeudi.')
  await panneau.getByRole('button', { name: 'Commenter', exact: true }).click()
  await expect(panneau.getByRole('listitem')).toContainText('Coach Nord, Coach')
  await panneau.getByRole('button', { name: 'Retirer mon commentaire' }).click()
  await expect(panneau.getByRole('listitem')).toHaveCount(0)
})

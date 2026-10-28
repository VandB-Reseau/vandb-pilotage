import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { ouvrir, seConnecter, textesTropPetits, zonesTropPetites, type MagasinSimule, type MessageSimule, type VersionSimulee } from './supabase-simule'

// Échanges sur le budget et historique des versions. Données fictives : dépôt public.

const N = new Date().getFullYear()
const B = N + (new Date().getMonth() >= 8 ? 1 : 0) // année du budget, comme l'app
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: 'en_discussion', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
const duSiege: MessageSimule = {
  id: 1, store_name: MAGASINS[0], annee: B, sujet: 'ca', texte: 'Proposition : +5 % sur la bière, en ligne avec le réseau.',
  auteur: '00000000-0000-0000-0000-0000000000dd', auteur_role: 'directeur', auteur_nom: null, cree_le: `${N}-10-20T09:30:00Z`,
}
// Le franchisé ajuste les tickets de la Cave (sa bière) à −5 % : la bière pèse 120/360 des 600 000 € de CA, soit 200 000 € ; −10 000 € de CA à
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

test('le franchisé répond au siège sur un sujet, retire son message et voit les versions du budget', async ({ page, isMobile }, info) => {
  const ecritures = await seConnecter(page, { role: 'franchise', magasins: [magasin], messages: [duSiege], versions })
  await ouvrir(page, 'Échanges et versions')
  const echanges = page.getByRole('region', { name: 'Échanges sur le budget' })
  const messages = echanges.getByRole('list', { name: 'Messages' }).getByRole('listitem')
  await expect(messages).toHaveCount(1)
  await expect(messages.first()).toContainText('Directeur de réseau')
  await expect(messages.first()).toContainText('Chiffre d’affaires')
  await expect(messages.first().getByRole('button', { name: 'Retirer mon message' })).toHaveCount(0)

  await expect(echanges.getByRole('button', { name: 'Envoyer' })).toBeDisabled()
  await echanges.getByRole('combobox', { name: 'Sujet' }).click()
  await page.getByRole('option', { name: 'Chiffre d’affaires' }).click()
  await echanges.getByRole('textbox', { name: 'Message' }).fill('La bière stagne depuis l’été : je préfère rester à 0 %.')
  await echanges.getByRole('button', { name: 'Envoyer' }).click()
  await expect(messages).toHaveCount(2)
  await expect(messages.last()).toContainText('Franchisé · Franchise Test')
  await expect(echanges.getByRole('textbox', { name: 'Message' })).toHaveValue('')
  expect(ecritures.find((e) => e.table === 'echanges_budget' && e.methode === 'POST')?.corps)
    .toEqual({ store_name: MAGASINS[0], annee: B, sujet: 'ca', texte: 'La bière stagne depuis l’été : je préfère rester à 0 %.' })

  // Versions, de la plus récente à la plus ancienne
  const lignes = page.getByRole('table', { name: `Versions du budget ${B}` }).getByRole('row')
  await expect(lignes).toHaveCount(3)
  await expect(lignes.nth(1)).toContainText('Franchisé · Franchise Test')
  await expect(lignes.nth(1)).toContainText('En discussion')
  await expect(lignes.nth(1).getByRole('cell').last()).toContainText(/[−-]3\s170/)
  await expect(lignes.nth(2)).toContainText('Proposé par le siège')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.getByRole('region', { name: 'Échanges sur le budget' }).screenshot({ path: `captures/${info.project.name}-echanges-budget.png` })

  await messages.last().getByRole('button', { name: 'Retirer mon message' }).click()
  await expect(messages).toHaveCount(1)
})

test('le Coach écrit aussi ; sans message ni version, la carte reste sobre', async ({ page }) => {
  await seConnecter(page, { role: 'coach', magasins: [magasin] })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await ouvrir(page, 'Échanges et versions')
  const echanges = page.getByRole('region', { name: 'Échanges sur le budget' })
  await expect(echanges).toContainText('Aucun message pour l’instant.')
  await expect(page.getByRole('region', { name: 'Historique du budget' })).toHaveCount(0)
  await echanges.getByRole('textbox', { name: 'Message' }).fill('On en parle à ma visite de jeudi.')
  await echanges.getByRole('button', { name: 'Envoyer' }).click()
  await expect(echanges.getByRole('listitem')).toContainText('Coach · Coach Nord')
})

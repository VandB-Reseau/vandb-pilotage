import { expect, test } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { seConnecter, textesTropPetits, zonesTropPetites, type FraisSimule, type MagasinSimule, type PersonneSimulee, type QuadrimestreSimule, type VenteSimulee } from './supabase-simule'

// Espace franchisé : en tête de la fiche, ce qu'il a à faire, chaque ligne mène à l'onglet. Données fictives : dépôt public.
// Le jour est figé au 15 octobre : réel de septembre attendu, quadrimestres de janvier à avril et de mai à août.

const N = new Date().getFullYear()
const jour = new Date(N, 9, 15, 10)
const magasin: MagasinSimule = { magasin: MAGASINS[0], statut: 'propose', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }
// Réel saisi de janvier à août
const reel: VenteSimulee[] = [1, 2, 3, 4, 5, 6, 7, 8].map((m) =>
  ({ store_name: MAGASINS[0], mois: `${N}-0${m}-01`, univers: 'cave', famille: 'Bière', ca_ht: 50_000, ca_ttc: 60_000, marge_ht: 20_000 }))
const quadri = (q: number): QuadrimestreSimule =>
  ({ store_name: MAGASINS[0], annee: N, quadrimestre: q, achats: 120_000, variation_stock: 0, charges_externes: 30_000, impots_taxes: 3_000, personnel: 35_000, tresorerie: 20_000 })
const equipe: PersonneSimulee[] = [{ id: 1, store_name: MAGASINS[0], poste: 'Vendeur', categorie: 'employe', heures_hebdo: 35, brut_mensuel: 2_000, primes: [], entree: null, sortie: null }]
const frais: FraisSimule[] = [{ store_name: MAGASINS[0], code: 'loyer', libelle: 'Loyer', rubrique: 'charges_externes', annuel: 36_000, taux_ca: null }]
const aFaire = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'À faire' })

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
  await page.clock.setFixedTime(jour)
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

test('le franchisé voit ce qu’il a à faire et y va en un clic, sans la comparaison aux autres magasins', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [magasin], reel, quadrimestres: [quadri(1)] })
  const liste = aFaire(page)
  await expect(liste.getByRole('listitem')).toHaveText([
    /Réel de septembre à saisir/,
    new RegExp(`Quadrimestre mai à août ${N} à saisir`),
    new RegExp(`Budget ${N + 1} proposé par le siège, à relire`),
    /Équipe à renseigner/,
    /Frais à renseigner/,
  ])
  await expect(page.getByRole('region', { name: 'Face au réseau', exact: true })).toHaveCount(0)
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-espace-franchise.png`, fullPage: true })

  await liste.getByRole('button', { name: `Saisir : Quadrimestre mai à août ${N} à saisir` }).click()
  await expect(page.getByRole('tab', { name: 'Quadrimestres' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Synthèse' }).click()
  await aFaire(page).getByRole('button', { name: 'Saisir : Réel de septembre à saisir' }).click()
  await expect(page.getByRole('tab', { name: /Réel/ })).toHaveAttribute('aria-selected', 'true')
})

test('tout est à jour : une seule ligne rassurante', async ({ page }) => {
  const valide = { ...magasin, statut: 'valide' as const }
  const septembre: VenteSimulee = { ...reel[0], mois: `${N}-09-01` }
  await seConnecter(page, { role: 'franchise', magasins: [valide], reel: [...reel, septembre], quadrimestres: [quadri(1), quadri(2)], equipe, frais })
  await expect(aFaire(page)).toContainText('Tout est à jour')
  await expect(aFaire(page).getByRole('button')).toHaveCount(0)
})

test('l’équipe ne voit pas la liste du franchisé', async ({ page }) => {
  await seConnecter(page, { role: 'directeur', magasins: [magasin], reel })
  await page.getByText(MAGASINS[0], { exact: true }).last().click()
  await expect(page.getByRole('tab', { name: 'Synthèse' })).toHaveAttribute('aria-selected', 'true')
  await expect(aFaire(page)).toHaveCount(0)
})

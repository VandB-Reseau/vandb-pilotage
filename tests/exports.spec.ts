import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { magasinFictif, MAGASINS } from './donnees-fictives'
import { celluleXml, lireClasseur } from './lecture-xlsx'
import { seConnecter, textesTropPetits, zonesTropPetites, type VenteSimulee } from './supabase-simule'

// Export Excel, impression et filtre par Responsable Régional. Données fictives uniquement : dépôt public.

const N = new Date().getFullYear()
const vente = (magasin: string, m: number, ca: number): VenteSimulee =>
  ({ store_name: magasin, mois: `${N}-${String(m).padStart(2, '0')}-01`, univers: 'cave', famille: 'Bière', ca_ht: ca, ca_ttc: ca * 1.2, marge_ht: ca * 0.4 })
const reel = [vente(MAGASINS[0], 1, 50_000), vente(MAGASINS[1], 1, 30_000), vente(MAGASINS[2], 1, 20_000)]
const coachs = { [MAGASINS[0]]: 'Coach Nord', [MAGASINS[1]]: 'Coach Sud', [MAGASINS[2]]: 'Coach Sud' }
const rrs = { [MAGASINS[0]]: ['RR Nord'], [MAGASINS[1]]: ['RR Nord', 'RR Est'], [MAGASINS[2]]: ['RR Est'] }

test.beforeEach(async ({ page }) => {
  const erreurs: string[] = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  ;(page as unknown as { erreurs: string[] }).erreurs = erreurs
})
test.afterEach(async ({ page }) => {
  expect((page as unknown as { erreurs: string[] }).erreurs, 'aucune erreur JavaScript').toEqual([])
})

async function telechargement(page: Page, bouton: string) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: bouton }).click()])
  const chemin = await d.path()
  return { nom: d.suggestedFilename(), fichiers: lireClasseur(new Uint8Array(readFileSync(chemin))) }
}

test('vue réseau : filtre par Responsable Régional, export de la sélection', async ({ page, isMobile }, info) => {
  await seConnecter(page, { reel, coachs, rrs })
  await page.getByRole('link', { name: 'Réseau' }).first().click()
  const tableau = page.getByRole('table', { name: `Réel ${N} par magasin` })
  const lignes = tableau.getByRole('row')
  await expect(lignes).toHaveCount(5)
  if (!isMobile) await expect(lignes.nth(3)).toContainText('RR Nord, RR Est')

  await page.getByLabel('Responsable Régional').click()
  await expect(page.getByRole('option')).toHaveText(['Tous les Responsables Régionaux', 'RR Est', 'RR Nord'])
  await page.getByRole('option', { name: 'RR Est' }).click()
  await expect(lignes).toHaveCount(4)                                   // total + Valcourt et Saint-Aubin
  await expect(lignes.nth(1)).toContainText('Total de la sélection')
  await expect(lignes.nth(1)).toContainText(/50\sk€/)
  expect(page.url()).toContain('rr=RR+Est')
  expect(await textesTropPetits(page)).toEqual([])
  if (isMobile) expect(await zonesTropPetites(page)).toEqual([])
  await page.screenshot({ path: `captures/${info.project.name}-reseau-rr.png`, fullPage: true })

  const { nom, fichiers } = await telechargement(page, 'Exporter en Excel')
  expect(nom).toBe(`Reseau ${N} - RR Est.xlsx`)
  const f = fichiers['xl/worksheets/sheet1.xml']
  expect(celluleXml(f, 'A2')).toContain('RR Est · exporté le')
  expect(celluleXml(f, 'A5')).toContain('Total de la sélection')
  expect(celluleXml(f, 'C4')).toContain('Responsable Régional')
  expect(celluleXml(f, 'E5')).toBe('<f>SUM(E6:E7)</f><v>50000</v>')
  expect(f).toContain(MAGASINS[1])
  expect(f).not.toContain(MAGASINS[0])
})

test('vue réseau : le RR et le Coach n’ont pas de filtre par RR', async ({ page }) => {
  await seConnecter(page, { role: 'rr', reel, coachs })
  await page.getByRole('link', { name: 'Réseau' }).first().click()
  await expect(page.getByRole('table', { name: `Réel ${N} par magasin` })).toBeVisible()
  await expect(page.getByLabel('Responsable Régional')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Responsable Régional' })).toHaveCount(0)
})

test('vue réseau imprimée : sans menu ni filtres, sélection et date en tête', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'impression depuis le PC')
  await seConnecter(page, { reel, coachs, rrs })
  await page.getByRole('link', { name: 'Réseau' }).first().click()
  await page.getByLabel('Coach').click()
  await page.getByRole('option', { name: 'Coach Sud' }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Exporter en Excel' })).toBeHidden()
  await expect(page.getByText(/Coach Sud · imprimé le/)).toBeVisible()
  await expect(page.getByRole('table', { name: `Réel ${N} par magasin` }).getByRole('row')).toHaveCount(4)
  await page.screenshot({ path: `captures/${info.project.name}-reseau-impression.png`, fullPage: true })
})

test('budget : export Excel du compte de résultat et des hypothèses, impression', async ({ page, isMobile }, info) => {
  await seConnecter(page, { role: 'franchise', magasins: [{ magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, base: magasinFictif, ajustements: {}, maj_le: null }] })
  await page.getByRole('tab', { name: /^Budget/ }).click()
  const annee = Number((await page.getByRole('tab', { name: /^Budget/ }).textContent())?.match(/\d{4}/)?.[0])

  const { nom, fichiers } = await telechargement(page, 'Exporter en Excel')
  expect(nom).toBe(`Budget ${annee} - ${MAGASINS[0]}.xlsx`)
  expect(fichiers['xl/workbook.xml']).toContain('name="Compte de résultat"')
  expect(fichiers['xl/workbook.xml']).toContain('name="Hypothèses"')
  const compte = fichiers['xl/worksheets/sheet1.xml']
  expect(celluleXml(compte, 'A2')).toContain('Validé · exporté le')
  expect(celluleXml(compte, 'A5')).toContain('Chiffre d’affaires HT')
  expect(celluleXml(compte, 'B5')).toBe('<v>48000</v>')                 // janvier : 7,5 % de 640 000 €
  expect(celluleXml(compte, 'N5')).toBe('<f>SUM(B5:M5)</f><v>640000</v>')
  const hyp = fichiers['xl/worksheets/sheet2.xml']
  expect(celluleXml(hyp, 'A5')).toContain('Bière')
  expect(celluleXml(hyp, 'H5')).toMatch(/^<f>E5\*\(F5-G5\)<\/f><v>[\d.]+<\/v>$/)

  if (isMobile) {
    await expect(page.getByRole('button', { name: 'Imprimer' })).toBeHidden()
    expect(await zonesTropPetites(page)).toEqual([])
    return
  }
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('tablist', { name: 'Vues du magasin' })).toBeHidden()
  await expect(page.getByRole('group', { name: 'Actions sur le budget' }).or(page.getByLabel('Actions sur le budget'))).toBeHidden()
  await expect(page.getByText(new RegExp(`Budget ${annee} · imprimé le`))).toBeVisible()
  await expect(page.getByRole('table', { name: `Budget ${annee} mois par mois` })).toBeVisible()
  await page.screenshot({ path: `captures/${info.project.name}-budget-impression.png`, fullPage: true })
})

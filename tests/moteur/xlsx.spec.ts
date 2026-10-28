import { expect, test } from '@playwright/test'
import { feuilleReseau, feuillesBudget, type LigneExportReseau } from '../../src/lib/exports'
import { classeur, colonne, crc32 } from '../../src/lib/xlsx'
import type { LigneCompte } from '../../src/moteur/compteResultat'
import { totalReseau } from '../../src/moteur/suivi'
import type { ResultatFamille } from '../../src/moteur/types'
import { celluleXml, lireClasseur } from '../lecture-xlsx'

// Exports Excel sur des chiffres fictifs : formules et valeurs vérifiées à la main.

test('classeur : archive lisible, contrôles d’intégrité justes, colonnes nommées comme dans Excel', () => {
  expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)   // valeur de référence du CRC-32
  expect([0, 25, 26, 27, 51, 52].map(colonne)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA'])
  const octets = classeur([{ nom: 'Essai : 1/2', lignes: [['Texte <&>', 12.5, { v: 25, f: 'B1*2', s: 'euros' }]] }])
  const f = lireClasseur(octets)
  expect(Object.keys(f)).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'])
  expect(f['xl/workbook.xml']).toContain('name="Essai   1 2"')             // caractères interdits dans un nom de feuille
  const feuille = f['xl/worksheets/sheet1.xml']
  expect(celluleXml(feuille, 'A1')).toContain('Texte &lt;&amp;&gt;')
  expect(celluleXml(feuille, 'B1')).toBe('<v>12.5</v>')
  expect(celluleXml(feuille, 'C1')).toBe('<f>B1*2</f><v>25</v>')
  expect(feuille).toContain('<c r="C1" s="5">')                           // style « euros »
})

test('budget : totaux et parts du CA en formules, marge recalculée famille par famille', () => {
  const lignes: LigneCompte[] = [
    { cle: 'ca', libelle: 'Chiffre d’affaires HT', mois: Array(12).fill(10_000), total: 120_000, fort: true },
    { cle: 'ca/cave', libelle: 'Cave', mois: Array(12).fill(6_000), total: 72_000, parent: 'ca' },
    { cle: 'achats', libelle: 'Achats consommés HT', mois: Array(12).fill(-6_000), total: -72_000 },
    { cle: 'net', libelle: 'Résultat net', mois: Array(12).fill(null), total: 9_000, fort: true },
    { cle: 'productivite', libelle: 'CA par heure travaillée', mois: Array(12).fill(80), total: 80, indicateur: true },
  ]
  const familles: ResultatFamille[] = [
    { univers: 'cave', famille: 'Bière', caRealise: 0, margeRealisee: 0, evolution: 0.1, margeCible: 0.36, demarque: 0.02, atterrissage: 100_000, objectif: 110_000, margeObjectif: 37_400 },
    { univers: 'bar', famille: 'Fût', caRealise: 0, margeRealisee: 0, evolution: 0, margeCible: 0.74, atterrissage: 50_000, objectif: 50_000, margeObjectif: 37_000 },
  ]
  const [compte, hyp] = feuillesBudget({ magasin: 'Brionne-sur-Lac', annee: 2027, statut: 'Validé', lignes, familles })
  const f = lireClasseur(classeur([compte, hyp]))
  const c = f['xl/worksheets/sheet1.xml'], h = f['xl/worksheets/sheet2.xml']

  expect(celluleXml(c, 'A1')).toContain('Budget 2027 - Brionne-sur-Lac')
  expect(celluleXml(c, 'N4')).toContain('Total')
  expect(celluleXml(c, 'N5')).toBe('<f>SUM(B5:M5)</f><v>120000</v>')
  expect(celluleXml(c, 'O5')).toBe('<f>IF(N$5=0,0,N5/N$5)</f><v>1</v>')
  expect(celluleXml(c, 'O7')).toBe('<f>IF(N$5=0,0,N7/N$5)</f><v>-0.6</v>')     // achats : −72 000 / 120 000
  expect(c).toContain('<c r="A6" s="4"')                                  // détail en retrait
  expect(celluleXml(c, 'B8')).toBeNull()                                  // résultat net : sur l'année seulement
  expect(celluleXml(c, 'N8')).toBe('<v>9000</v>')
  expect(celluleXml(c, 'O9')).toBeNull()                                  // CA par heure : pas de part du CA
  expect(c).toContain('<pane xSplit="1" ySplit="4" topLeftCell="B5"')

  // Familles en lignes 5 et 6, total en ligne 7
  expect(celluleXml(h, 'H5')).toBe('<f>E5*(F5-G5)</f><v>37400</v>')       // 110 000 × (36 % − 2 %)
  expect(celluleXml(h, 'G6')).toBe('<v>0</v>')                            // Fût sans démarque
  expect(celluleXml(h, 'C7')).toBe('<f>SUM(C5:C6)</f><v>150000</v>')
  expect(celluleXml(h, 'E7')).toBe('<f>SUM(E5:E6)</f><v>160000</v>')
  expect(celluleXml(h, 'H7')).toBe('<f>SUM(H5:H6)</f><v>74400</v>')
  // Marge visée : (74 400 + démarque 2 200) / 160 000 = 47,875 % ; démarque : 2 200 / 160 000 = 1,375 %
  expect(celluleXml(h, 'F7')).toBe('<f>IF(E7=0,0,(H7+SUMPRODUCT(E5:E6,G5:G6))/E7)</f><v>0.47875</v>')
  expect(celluleXml(h, 'G7')).toBe('<f>IF(E7=0,0,SUMPRODUCT(E5:E6,G5:G6)/E7)</f><v>0.01375</v>')
})

test('réseau : une ligne par magasin, total de la sélection, colonnes Coach et RR à la demande', () => {
  const ligne = (magasin: string, ca: number, rrs: string[]): LigneExportReseau => ({
    magasin, moisRealises: 2, ca, evolution: 0.1, ecartBudget: -0.05, tauxMarge: 0.4, panierTTC: 30, personnelSurMarge: null, ebeSurCA: null,
    sommes: { ca, caN1: ca / 1.1, caBudget: ca / 0.95, marge: 0.4 * ca, caAvecMarge: ca, ttc: 0, tickets: 0, personnel: 0, marge100: 0, ebe: 0, caEbe: 0 },
    coach: 'Coach Nord', rrs, groupe: '',
  } as unknown as LigneExportReseau)
  const lignes = [ligne('Brionne-sur-Lac', 50_000, ['RR Nord']), ligne('Valcourt', 30_000, ['RR Nord', 'RR Est'])]
  const total = { ...totalReseau([]), magasins: 2, ca: 80_000, evolution: 0.1, ecartBudget: -0.05, tauxMarge: 0.4, panierTTC: 30 }
  const f = lireClasseur(classeur([feuilleReseau({ annee: 2027, selection: 'RR Nord', lignes, total, avec: { coach: true, rr: true, groupe: false } })]))
  const s = f['xl/worksheets/sheet1.xml']
  expect(f['xl/workbook.xml']).toContain('name="Réseau 2027"')
  expect(celluleXml(s, 'A2')).toContain('RR Nord · exporté le')
  expect(celluleXml(s, 'C4')).toContain('Responsable Régional')
  expect(celluleXml(s, 'A5')).toContain('Total de la sélection')
  expect(celluleXml(s, 'D5')).toContain('2 magasins')
  expect(celluleXml(s, 'E5')).toBe('<f>SUM(E6:E7)</f><v>80000</v>')
  expect(celluleXml(s, 'C7')).toContain('RR Nord, RR Est')
  expect(celluleXml(s, 'D6')).toContain('Févr.')
  expect(celluleXml(s, 'J6')).toBeNull()                                  // masse salariale non renseignée : cellule vide
})

test('budget : feuille de trésorerie, solde de fin de mois enchaîné en formules', () => {
  const mois = Array.from({ length: 12 }, (_, i) => ({
    encaissements: 11_900, fournisseurs: 7_200, frais: 1_660, personnel: 2_000, tva: 440, emprunts: 300, impot: 0, travaux: 0,
    consignesVersees: 900, consignesRemboursees: 900, consignesEnAttente: 1_800,
    decaissements: 12_500, flux: 300, fin: 5_000 + 300 * (i + 1),
  }))
  const tresorerie = { debut: 5_000, mois, fin: 8_600, pointBas: { montant: 5_300, mois: 0 }, moisNegatifs: 0, consignesMoyennes: 1_800 }
  const feuilles = feuillesBudget({ magasin: 'Brionne-sur-Lac', annee: 2027, statut: 'Validé', lignes: [], familles: [], tresorerie })
  const f = lireClasseur(classeur(feuilles))
  expect(f['xl/workbook.xml']).toContain('name="Trésorerie"')
  const t = f['xl/worksheets/sheet3.xml']
  expect(celluleXml(t, 'B5')).toBe('<v>5000</v>')                        // trésorerie au 1er janvier
  expect(celluleXml(t, 'B6')).toBe('<v>11900</v>')
  expect(celluleXml(t, 'B7')).toBe('<v>900</v>')                         // consignes remboursées, en entrée
  expect(celluleXml(t, 'B8')).toBe('<v>-7200</v>')                       // fournisseurs, en sortie
  expect(celluleXml(t, 'B15')).toBe('<v>-900</v>')                       // consignes versées
  expect(celluleXml(t, 'B16')).toBe('<f>SUM(B8:B15)</f><v>-12500</v>')
  expect(celluleXml(t, 'B17')).toBe('<f>SUM(B6:B7)+B16</f><v>300</v>')
  expect(celluleXml(t, 'B18')).toBe('<f>$B$5+B17</f><v>5300</v>')
  expect(celluleXml(t, 'C18')).toBe('<f>B18+C17</f><v>5600</v>')
  expect(celluleXml(t, 'N17')).toBe('<f>SUM(B17:M17)</f><v>3600</v>')
  expect(celluleXml(t, 'N18')).toBe('<f>M18</f><v>8600</v>')
})

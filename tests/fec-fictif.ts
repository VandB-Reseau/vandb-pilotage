// FEC fictif d'un magasin, de janvier à avril (et une écriture en mai) : dépôt public, aucune donnée réelle.
// Montants à retrouver, vérifiés à la main : achats 98 000 (100 000 − 2 000 de remises), stock en hausse de 5 000,
// charges externes 18 000 (loyer 12 000, redevance 4 000, publicité 2 000), impôts et taxes 1 500,
// personnel 39 000 (salaires 25 000, gérant 6 000, cotisations 8 000), trésorerie fin avril 50 000 (20 000 + 200 000 − 170 000),
// 300 € de charges diverses (658) à classer, 400 € d'intérêts hors EBE, CA 200 000.
const COLONNES = 'JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise'
const ECRITURES: [string, string, string, string, string][] = [
  // journal, date (MMJJ), compte, libellé, débit ou crédit (C devant)
  ['AN', '0101', '512000', 'Banque', '20000,00'],
  ['AN', '0101', '101000', 'Capital', 'C20000,00'],
  ['HA', '0210', '607100', 'Achats bières', '100000,00'],
  ['HA', '0210', '401000', 'Fournisseurs', 'C100000,00'],
  ['HA', '0331', '609700', 'Remises obtenues', 'C2000,00'],
  ['OD', '0430', '603700', 'Variation des stocks de marchandises', 'C5000,00'],
  ['HA', '0105', '613200', 'Loyer', '12000,00'],
  ['HA', '0131', '651100', 'Redevance de franchise', '4000,00'],
  ['HA', '0131', '623100', 'Publicité', '2000,00'],
  ['HA', '0315', '635110', 'Cotisation foncière', '1500,00'],
  ['OD', '0430', '641100', 'Salaires', '25000,00'],
  ['OD', '0430', '644000', 'Rémunération du gérant', '6000,00'],
  ['OD', '0430', '645100', 'Cotisations URSSAF', '8000,00'],
  ['OD', '0430', '658000', 'Charges diverses', '300,00'],
  ['BQ', '0430', '661100', 'Intérêts', '400,00'],
  ['VT', '0430', '707100', 'Ventes de marchandises', 'C200000,00'],
  ['BQ', '0430', '512000', 'Banque', '200000,00'],
  ['BQ', '0430', '512000', 'Banque', 'C170000,00'],
  ['BQ', '0515', '512000', 'Banque', '10000,00'],
  ['HA', '0515', '607100', 'Achats bières', '1000,00'],
]
export function fecFictif(annee: number): string {
  const lignes = ECRITURES.map(([j, d, compte, lib, m], i) => {
    const credit = m.startsWith('C'), montant = m.replace('C', '')
    const date = `${annee}${d}`
    return [j, j, String(i + 1), date, compte, lib, '', '', `P${i + 1}`, date, lib, credit ? '0,00' : montant, credit ? montant : '0,00', '', '', date, '', ''].join('\t')
  })
  return [COLONNES, ...lignes].join('\r\n') + '\r\n'
}

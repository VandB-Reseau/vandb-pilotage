// Modèles de fichiers d'import (lot 32, Joseph 29/10/2026) : la ligne des colonnes et des lignes d'exemple, au format
// décrit dans docs/import-caisse.md. Le code magasin « EXEMPLE » n'est rattaché à aucun magasin : un modèle importé tel
// quel n'écrit rien. Données fictives : dépôt public.
export interface Modele { fichier: string; texte: string }

const csv = (lignes: string[]) => `${lignes.join('\r\n')}\r\n`

export const MODELES = {
  ventes: {
    fichier: 'modele_ventes_AAAA-MM.csv',
    texte: csv([
      'code_magasin;date;univers;famille;ca_ht;ca_ttc;marge_ht',
      'EXEMPLE;2027-01;CAVE;BIERE;12500,00;15000,00;4500,00',
      'EXEMPLE;2027-01;CAVE;VIN;8000,00;9600,00;2960,00',
      'EXEMPLE;2027-01;BAR;FUT;9000,00;9900,00;6750,00',
      'EXEMPLE;2027-01;EXTERIEUR;FACTURES;3000,00;3600,00;1200,00',
    ]),
  },
  tickets: {
    fichier: 'modele_tickets_AAAA-MM.csv',
    texte: csv([
      'code_magasin;date;univers;tickets',
      'EXEMPLE;2027-01;CAVE;620',
      'EXEMPLE;2027-01;BAR;1450',
    ]),
  },
  quadrimestres: {
    fichier: 'modele_quadrimestres_AAAA-Q.csv',
    texte: csv([
      'code_magasin;annee;quadrimestre;achats;variation_stock;charges_externes;impots_taxes;personnel;tresorerie',
      'EXEMPLE;2027;1;130000;8000;30000;3000;35000;25000',
    ]),
  },
  // FEC : format fixé par l'administration fiscale (article A47 A-1 du livre des procédures fiscales), 18 colonnes
  // séparées par une tabulation. Le cabinet comptable l'exporte tel quel ; l'exemple montre les comptes lus par l'app.
  fec: {
    fichier: 'exemple_FEC.txt',
    texte: [
      ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'],
      ['AC', 'Achats', '1', '20270115', '607000', 'Achats de marchandises', '', '', 'F001', '20270115', 'Facture brasseur', '1000,00', '0,00', '', '', '20270131', '', ''],
      ['AC', 'Achats', '1', '20270115', '445660', 'TVA déductible', '', '', 'F001', '20270115', 'Facture brasseur', '200,00', '0,00', '', '', '20270131', '', ''],
      ['AC', 'Achats', '1', '20270115', '401000', 'Fournisseurs', 'BRASS', 'Brasseur', 'F001', '20270115', 'Facture brasseur', '0,00', '1200,00', '', '', '20270131', '', ''],
      ['OD', 'Opérations diverses', '2', '20270430', '603700', 'Variation des stocks de marchandises', '', '', 'INV04', '20270430', 'Stock au 30 avril', '0,00', '2500,00', '', '', '20270430', '', ''],
      ['OD', 'Opérations diverses', '2', '20270430', '370000', 'Stocks de marchandises', '', '', 'INV04', '20270430', 'Stock au 30 avril', '2500,00', '0,00', '', '', '20270430', '', ''],
      ['AC', 'Achats', '3', '20270131', '613200', 'Loyer', '', '', 'L01', '20270131', 'Loyer janvier', '2000,00', '0,00', '', '', '20270131', '', ''],
      ['AC', 'Achats', '3', '20270131', '401000', 'Fournisseurs', 'BAIL', 'Bailleur', 'L01', '20270131', 'Loyer janvier', '0,00', '2000,00', '', '', '20270131', '', ''],
      ['OD', 'Salaires', '4', '20270131', '641100', 'Salaires', '', '', 'P01', '20270131', 'Paie janvier', '3000,00', '0,00', '', '', '20270131', '', ''],
      ['OD', 'Salaires', '4', '20270131', '645100', 'Cotisations URSSAF', '', '', 'P01', '20270131', 'Paie janvier', '900,00', '0,00', '', '', '20270131', '', ''],
      ['OD', 'Salaires', '4', '20270131', '421000', 'Personnel, rémunérations dues', '', '', 'P01', '20270131', 'Paie janvier', '0,00', '3900,00', '', '', '20270131', '', ''],
      ['BQ', 'Banque', '5', '20270131', '512000', 'Banque', '', '', 'R01', '20270131', 'Remise CB janvier', '15000,00', '0,00', '', '', '20270131', '', ''],
      ['BQ', 'Banque', '5', '20270131', '707000', 'Ventes de marchandises', '', '', 'R01', '20270131', 'Remise CB janvier', '0,00', '12500,00', '', '', '20270131', '', ''],
      ['BQ', 'Banque', '5', '20270131', '445710', 'TVA collectée', '', '', 'R01', '20270131', 'Remise CB janvier', '0,00', '2500,00', '', '', '20270131', '', ''],
    ].map((l) => l.join('\t')).join('\r\n') + '\r\n',
  },
} satisfies Record<string, Modele>

export function telechargerModele(m: Modele) {
  // BOM : Excel ouvre le CSV en UTF-8 (accents)
  const url = URL.createObjectURL(new Blob(['﻿', m.texte], { type: m.fichier.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = m.fichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

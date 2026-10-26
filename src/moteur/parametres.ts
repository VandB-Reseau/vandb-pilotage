import type { LigneFrais, ParametresReseau, Rubrique } from './types'

// Paramètres réseau par défaut (Joseph, 26/10/2026) : redevance 2 % et publicité 1 % du CA HT, au-dessus de l'EBE.
// Impôt sur les sociétés : taux PME 2026 (15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà), à reconfirmer chaque année.
// TVA du panier : alcool à 20 % ; le Bar mêle boissons à 20 % et restauration à 10 %, d'où un taux moyen modifiable.
export const parametresParDefaut: ParametresReseau = {
  tauxRedevance: 0.02,
  tauxPublicite: 0.01,
  impot: { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 },
  tvaPanier: { cave: 0.2, bar: 0.18 },
}

export const rubriqueLibelle: Record<Rubrique, string> = {
  immobilier: 'Immobilier',
  energies: 'Énergies',
  entretien: 'Entretien et équipement',
  honoraires: 'Honoraires',
  communication: 'Communication',
  deplacements: 'Déplacements et réceptions',
  banque_assurances: 'Banque et assurances',
  autres: 'Autres frais',
  impots_taxes: 'Impôts et taxes',
}

// Grille des frais commune au réseau, reprise des lignes du budget de frais (onglet FFBUD du prévisionnel).
// La redevance et la publicité franchise sont calculées à part, sur le CA.
export const lignesFrais: Omit<LigneFrais, 'annuel' | 'tauxCA'>[] = [
  { code: 'energie', libelle: 'Électricité, eau, gaz', rubrique: 'energies' },
  { code: 'carburant', libelle: 'Carburant', rubrique: 'energies' },
  { code: 'loyer', libelle: 'Locations immobilières', rubrique: 'immobilier' },
  { code: 'charges_locatives', libelle: 'Charges locatives', rubrique: 'immobilier' },
  { code: 'entretien_immobilier', libelle: 'Entretien et réparations des locaux', rubrique: 'immobilier' },
  { code: 'petit_equipement', libelle: 'Petit outillage et équipement', rubrique: 'entretien' },
  { code: 'vetements', libelle: 'Vêtements professionnels', rubrique: 'entretien' },
  { code: 'credit_bail', libelle: 'Crédit-bail mobilier', rubrique: 'entretien' },
  { code: 'locations_mobilieres', libelle: 'Locations mobilières', rubrique: 'entretien' },
  { code: 'entretien_materiel', libelle: 'Entretien et réparations du matériel', rubrique: 'entretien' },
  { code: 'maintenance', libelle: 'Maintenance et assistance', rubrique: 'entretien' },
  { code: 'fournitures', libelle: 'Fournitures administratives', rubrique: 'autres' },
  { code: 'documentation', libelle: 'Documentation générale', rubrique: 'autres' },
  { code: 'personnel_exterieur', libelle: 'Personnel extérieur', rubrique: 'autres' },
  { code: 'transports_achats', libelle: 'Transports sur achats', rubrique: 'autres' },
  { code: 'livraison', libelle: 'Frais de livraison (plateformes)', rubrique: 'autres' },
  { code: 'droits_auteur', libelle: 'Droits d’auteur', rubrique: 'autres' },
  { code: 'charges_diverses', libelle: 'Charges diverses', rubrique: 'autres' },
  { code: 'honoraires_comptables', libelle: 'Honoraires comptables', rubrique: 'honoraires' },
  { code: 'honoraires_social', libelle: 'Honoraires social', rubrique: 'honoraires' },
  { code: 'honoraires_juridiques', libelle: 'Honoraires juridiques', rubrique: 'honoraires' },
  { code: 'honoraires_divers', libelle: 'Honoraires divers', rubrique: 'honoraires' },
  { code: 'honoraires_holding', libelle: 'Honoraires holding', rubrique: 'honoraires' },
  { code: 'actes', libelle: 'Frais d’actes et de contentieux', rubrique: 'honoraires' },
  { code: 'publicite_locale', libelle: 'Publicité et animation locales', rubrique: 'communication' },
  { code: 'deplacements', libelle: 'Voyages et déplacements', rubrique: 'deplacements' },
  { code: 'receptions', libelle: 'Missions et réceptions', rubrique: 'deplacements' },
  { code: 'telecom', libelle: 'Frais postaux et télécom', rubrique: 'autres' },
  { code: 'banque', libelle: 'Services bancaires', rubrique: 'banque_assurances' },
  { code: 'assurances', libelle: 'Primes d’assurances', rubrique: 'banque_assurances' },
  { code: 'cotisations', libelle: 'Cotisations diverses', rubrique: 'autres' },
  { code: 'formations', libelle: 'Formations et transport', rubrique: 'autres' },
  { code: 'cfe', libelle: 'Cotisation foncière des entreprises', rubrique: 'impots_taxes' },
  { code: 'taxes_foncieres', libelle: 'Taxes foncières', rubrique: 'impots_taxes' },
  { code: 'enregistrement', libelle: 'Droits d’enregistrement et timbres', rubrique: 'impots_taxes' },
  { code: 'taxes_diverses', libelle: 'Taxes diverses', rubrique: 'impots_taxes' },
]

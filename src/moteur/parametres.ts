import { alertesParDefaut } from './alertes'
import type { ParametresCharges } from './equipe'
import { tresorerieParDefaut } from './tresorerie'
import type { LigneFrais, ParametresReseau, Rubrique } from './types'

// Paramètres réseau par défaut (Joseph, 26/10/2026) : redevance 2 % et publicité 1 % du CA HT, au-dessus de l'EBE.
// Impôt sur les sociétés : taux PME 2026 (15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà), à reconfirmer chaque année.
// TVA du panier : alcool à 20 % ; le Bar mêle boissons à 20 % et restauration à 10 %, d'où un taux moyen modifiable.
// Charges patronales 2026 avant réduction (accident du travail à 2 %, hors mutuelle et prévoyance de la convention) ;
// réduction générale 2026, entreprise de moins de 50 salariés (service-public.fr, fiche F24542). À revoir chaque année.
export const chargesParDefaut: ParametresCharges = {
  taux: { employe: 0.35, agent_maitrise: 0.35, cadre: 0.365, apprenti: 0.35, gerant_tns: 0.33 },
  reduction: { smicAnnuel: 21_876.4, tmin: 0.02, tdelta: 0.3781, puissance: 1.75, horsReduction: 0.0123 },
}

export const parametresParDefaut: ParametresReseau = {
  tauxRedevance: 0.02,
  tauxPublicite: 0.01,
  impot: { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 },
  tvaPanier: { cave: 0.2, bar: 0.18 },
  charges: chargesParDefaut,
  tresorerie: tresorerieParDefaut,
  alertes: alertesParDefaut,
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

// Grille des frais commune au réseau : les lignes de l'onglet FFBUD du prévisionnel, dans son ordre et rangées dans ses
// blocs (lot 23, Joseph, 28/10/2026). Publicité franchise et royalties sont calculées sur le CA (paramètres réseau) ;
// amortissements et intérêts se saisissent à part (CODES_FINANCES). racines : comptes du plan comptable de la ligne,
// pour retrouver la ligne d'un compte du FEC (la plus longue racine l'emporte).
export type BlocFrais = 'charges_externes' | 'impots_taxes' | 'autres_charges'
export const BLOCS_FRAIS: { cle: BlocFrais; libelle: string; total: string }[] = [
  { cle: 'charges_externes', libelle: 'Charges externes', total: 'Total des charges externes' },
  { cle: 'impots_taxes', libelle: 'Impôts et taxes', total: 'Total des impôts et taxes' },
  { cle: 'autres_charges', libelle: 'Autres charges', total: 'Total des autres charges' },
]
export interface LigneGrille extends Omit<LigneFrais, 'annuel' | 'tauxCA'> { bloc: BlocFrais; racines: string[] }
const ligne = (code: string, libelle: string, rubrique: Rubrique, bloc: BlocFrais, racines: string[]): LigneGrille => ({ code, libelle, rubrique, bloc, racines })
const ext = (code: string, libelle: string, rubrique: Rubrique, racines: string[]) => ligne(code, libelle, rubrique, 'charges_externes', racines)
const taxe = (code: string, libelle: string, racines: string[]) => ligne(code, libelle, 'impots_taxes', 'impots_taxes', racines)
export const lignesFrais: LigneGrille[] = [
  ext('energie', 'Électricité, eau, gaz', 'energies', ['6061']),
  ext('carburant', 'Carburant', 'energies', ['60614', '60622']),
  ext('petit_equipement', 'Entretien, petit outillage et équipement', 'entretien', ['6063']),
  ext('vetements', 'Vêtements professionnels', 'entretien', ['60636', '6068']),
  ext('fournitures', 'Fournitures administratives', 'autres', ['6064']),
  ext('credit_bail', 'Redevance de crédit-bail mobilier', 'entretien', ['612']),
  ext('loyer', 'Locations immobilières', 'immobilier', ['6132']),
  ext('locations_mobilieres', 'Locations mobilières', 'entretien', ['6135']),
  ext('charges_locatives', 'Charges locatives', 'immobilier', ['614']),
  ext('entretien_immobilier', 'Entretien et réparations immobilières', 'immobilier', ['6152']),
  ext('entretien_materiel', 'Entretien et réparations du matériel', 'entretien', ['6155', '615']),
  ext('maintenance', 'Maintenance et assistance', 'entretien', ['6156']),
  ext('assurances', 'Primes d’assurances', 'banque_assurances', ['616']),
  ext('documentation', 'Documentation générale', 'autres', ['618']),
  ext('personnel_exterieur', 'Personnel extérieur', 'autres', ['621']),
  ext('honoraires_comptables', 'Honoraires de comptabilité', 'honoraires', ['62261']),
  ext('honoraires_social', 'Honoraires social', 'honoraires', ['62262']),
  ext('honoraires_divers', 'Honoraires divers', 'honoraires', ['622']),
  ext('honoraires_juridiques', 'Honoraires juridiques', 'honoraires', ['62263']),
  ext('honoraires_holding', 'Honoraires holding', 'honoraires', []),
  ext('actes', 'Frais d’actes et de contentieux', 'honoraires', ['6227']),
  ext('livraison', 'Frais de livraison (agrégateurs)', 'autres', ['6242']),
  ext('publicite_locale', 'Publicité diverse et animation', 'communication', ['623']),
  // Joseph, 29/10/2026 : enveloppe de communication locale de l'année (réseaux sociaux, flyers, partenariats…)
  ext('budget_communication', 'Budget communication annuel', 'communication', []),
  ext('transports_achats', 'Transports sur achats', 'autres', ['6241']),
  ext('deplacements', 'Voyages et déplacements', 'deplacements', ['6251']),
  ext('receptions', 'Missions et réceptions', 'deplacements', ['6256', '6257']),
  ext('telecom', 'Frais postaux et télécom', 'autres', ['626']),
  ext('banque', 'Services bancaires', 'banque_assurances', ['627']),
  ext('cotisations', 'Cotisations diverses', 'autres', ['628']),
  ext('formations', 'Formations et transport', 'autres', ['6228']),
  taxe('formation_continue', 'Participation à la formation continue', ['6333']),
  taxe('taxe_apprentissage', 'Taxe d’apprentissage', ['6312']),
  taxe('cfe', 'Cotisation foncière des entreprises', ['63511']),
  taxe('taxes_foncieres', 'Taxes foncières', ['63512']),
  taxe('enregistrement', 'Droits d’enregistrement et timbres', ['6354']),
  taxe('taxes_diverses', 'Taxes diverses', ['63']),
  taxe('csg_gc', 'CSG déductible GC', []),
  taxe('csg_ac', 'CSG déductible AC', []),
  ligne('droits_auteur', 'Droits d’auteur', 'autres', 'autres_charges', ['6516']),
  ligne('charges_diverses', 'Charges diverses', 'autres', 'autres_charges', ['658']),
]
// Thèmes des encarts de l'onglet Frais (29/10/2026), dans cet ordre
export const THEMES_FRAIS: Rubrique[] = ['immobilier', 'energies', 'entretien', 'honoraires', 'communication', 'deplacements', 'banque_assurances', 'autres', 'impots_taxes']

// Lignes calculées sur le CA, à leur place dans le bloc des charges externes : publicité franchise après les
// frais de livraison, royalties en fin de bloc (comme dans l'onglet FFBUD, « comprises dans les charges externes »)
export const LIGNES_SUR_CA = { publicite: { libelle: 'Publicité franchise', apres: 'livraison' }, redevance: { libelle: 'Royalties', apres: 'formations' } } as const

// Bloc d'une ligne enregistrée : celui de la grille, sinon d'après sa rubrique
export function blocDe(l: Pick<LigneFrais, 'code' | 'rubrique'>): BlocFrais {
  return lignesFrais.find((g) => g.code === l.code)?.bloc ?? (l.rubrique === 'impots_taxes' ? 'impots_taxes' : 'charges_externes')
}

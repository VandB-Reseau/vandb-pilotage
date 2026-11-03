import { alertesParDefaut } from './alertes'
import type { ParametresCharges } from './equipe'
import { tresorerieParDefaut } from './tresorerie'
import type { BlocFrais, LigneFrais, LigneGrille, ParametresReseau, Rubrique } from './types'
export type { BlocFrais, LigneGrille } from './types'

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
export const BLOCS_FRAIS: { cle: BlocFrais; libelle: string; total: string }[] = [
  { cle: 'charges_externes', libelle: 'Charges externes', total: 'Total des charges externes' },
  { cle: 'impots_taxes', libelle: 'Impôts et taxes', total: 'Total des impôts et taxes' },
  { cle: 'autres_charges', libelle: 'Autres charges', total: 'Total des autres charges' },
]
const ligne = (code: string, libelle: string, rubrique: Rubrique, bloc: BlocFrais, racines: string[]): LigneGrille => ({ code, libelle, rubrique, bloc, racines })
const ext = (code: string, libelle: string, rubrique: Rubrique, racines: string[]) => ligne(code, libelle, rubrique, 'charges_externes', racines)
const taxe = (code: string, libelle: string, racines: string[]) => ligne(code, libelle, 'impots_taxes', 'impots_taxes', racines)
const grilleInitiale: LigneGrille[] = [
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
// Lignes que presque tous les magasins ont : point de départ d'une saisie (courantes)
const COURANTES = ['loyer', 'charges_locatives', 'energie', 'honoraires_comptables', 'assurances', 'banque', 'telecom', 'budget_communication', 'cfe']
export const lignesFrais: LigneGrille[] = grilleInitiale.map((l) => (COURANTES.includes(l.code) ? { ...l, courante: true } : l))

// Thèmes des encarts de l'onglet Frais (29/10/2026), dans cet ordre
export const THEMES_FRAIS: Rubrique[] = ['immobilier', 'energies', 'entretien', 'honoraires', 'communication', 'deplacements', 'banque_assurances', 'autres', 'impots_taxes']

// Lignes calculées sur le CA, à leur place dans le bloc des charges externes : publicité franchise après les
// frais de livraison, royalties en fin de bloc (comme dans l'onglet FFBUD, « comprises dans les charges externes »)
export const LIGNES_SUR_CA = { publicite: { libelle: 'Publicité franchise', apres: 'livraison' }, redevance: { libelle: 'Royalties', apres: 'formations' } } as const

// Bloc d'une ligne enregistrée : celui de la grille, sinon d'après sa rubrique
export function blocDe(l: Pick<LigneFrais, 'code' | 'rubrique'>, grille: LigneGrille[] = lignesFrais): BlocFrais {
  return grille.find((g) => g.code === l.code)?.bloc ?? blocDuTheme(l.rubrique)
}
export const blocDuTheme = (r: Rubrique): BlocFrais => (r === 'impots_taxes' ? 'impots_taxes' : 'charges_externes')

// ── Grille modifiable (lot 40) : la grille enregistrée dans les paramètres de l'année, plus les lignes par défaut qu'elle
// n'a pas encore (une ligne ajoutée au code apparaît partout). Aucune ligne ne se supprime : elle se masque.
export function completerGrille(g?: LigneGrille[] | null): LigneGrille[] {
  if (!g?.length) return lignesFrais
  return [...g, ...lignesFrais.filter((d) => !g.some((x) => x.code === d.code))]
}
export const grilleDe = (p?: { grilleFrais?: LigneGrille[] } | null): LigneGrille[] => completerGrille(p?.grilleFrais)
export const lignesActives = (grille: LigneGrille[]) => grille.filter((l) => !l.masquee)
export const lignesCourantes = (grille: LigneGrille[]) => grille.filter((l) => l.courante && !l.masquee).map((l) => l.code)
export const rangDans = (grille: LigneGrille[]) => (code: string) => { const i = grille.findIndex((g) => g.code === code); return i < 0 ? 999 : i }

// Lignes enregistrées d'un magasin, sous le libellé et le thème que la grille leur donne aujourd'hui (une ligne renommée
// ou changée de thème l'est pour tous les magasins). Les lignes hors grille restent telles quelles.
export function alignerSurGrille<T extends { code: string; libelle: string; rubrique: string }>(lignes: T[], grille: LigneGrille[]): T[] {
  return lignes.map((l) => {
    const g = grille.find((x) => x.code === l.code)
    return g && (g.libelle !== l.libelle || g.rubrique !== l.rubrique) ? { ...l, libelle: g.libelle, rubrique: g.rubrique } : l
  })
}

// Nouvelle ligne de la grille : code tiré du libellé, unique ; bloc d'après le thème
export function nouvelleLigneGrille(grille: LigneGrille[], libelle: string, rubrique: Rubrique): LigneGrille {
  const base = `ajout_${libelle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'ligne'}`
  let code = base, i = 2
  while (grille.some((g) => g.code === code)) code = `${base}_${i++}`
  return { code, libelle: libelle.trim(), rubrique, bloc: blocDuTheme(rubrique), racines: [] }
}

// Contrôles avant d'enregistrer la grille : messages lisibles (vide : tout est bon)
export function controlerGrille(grille: LigneGrille[]): string[] {
  const erreurs: string[] = []
  const vus = new Map<string, string>()
  for (const l of grille) {
    const nom = l.libelle.trim()
    if (!nom) { erreurs.push('Chaque ligne a besoin d’un libellé.'); continue }
    const cle = nom.toLowerCase()
    if (vus.has(cle)) erreurs.push(`Deux lignes s’appellent « ${nom} ».`)
    vus.set(cle, l.code)
    for (const r of l.racines) if (!/^6\d{1,7}$/.test(r)) erreurs.push(`${nom} : « ${r} » n’est pas un compte de charges (6…).`)
  }
  const comptes = new Map<string, string>()
  for (const l of lignesActives(grille)) for (const r of l.racines) {
    const deja = comptes.get(r)
    if (deja) erreurs.push(`Le compte ${r} est sur deux lignes : ${deja} et ${l.libelle.trim()}.`)
    else comptes.set(r, l.libelle.trim())
  }
  return [...new Set(erreurs)]
}

// Comptes saisis en texte (« 6061, 6062 ») : liste nettoyée
export const lireComptes = (t: string): string[] => [...new Set(t.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))]

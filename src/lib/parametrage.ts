import { categorieLibelle } from '../moteur/equipe'
import { completerGrille, rubriqueLibelle } from '../moteur/parametres'
import { reglesDe } from '../moteur/regles'
import type { LigneGrille } from '../moteur/types'
import { montant, taux } from './format'

// Journal des paramètres réseau (lot 39) : chaque ligne de la base est une rubrique modifiée (avant, après). Ici, on
// la rend lisible : « Redevance franchise : 2,0 % → 2,5 % », ou les valeurs changées d'une rubrique à plusieurs valeurs.

export const RUBRIQUES_PARAMETRES: Record<string, string> = {
  tauxRedevance: 'Redevance franchise',
  tauxPublicite: 'Publicité franchise',
  impot: 'Impôt sur les sociétés',
  tvaPanier: 'TVA moyenne du panier',
  charges: 'Charges sociales',
  tresorerie: 'Trésorerie',
  alertes: 'Alertes',
  campagne: 'Campagne des budgets',
  grilleFrais: 'Grille des frais',
  regles: 'Règles de calcul',
}
export const libelleRubrique = (r: string) => RUBRIQUES_PARAMETRES[r] ?? r

const LIBELLES: Record<string, string> = {
  tauxReduit: 'taux réduit', plafondTauxReduit: 'plafond du taux réduit', tauxNormal: 'taux normal',
  cave: 'Cave', bar: 'Bar', exterieur: 'Extérieur',
  ...Object.fromEntries(Object.entries(categorieLibelle).map(([k, v]) => [k, v])),
  smicAnnuel: 'SMIC annuel', tmin: 'taux minimal', tdelta: 'taux dégressif', puissance: 'puissance', horsReduction: 'part hors réduction',
  delaiFournisseurs: 'paiement des fournisseurs (mois)', avanceLivraison: 'livraison avant la vente (mois)', delaiRedevance: 'paiement de la redevance (mois)',
  tvaVentes: 'TVA sur les ventes', tvaAchats: 'TVA sur les achats', tvaFrais: 'TVA sur les frais', tvaTrimestrielle: 'TVA trimestrielle',
  partCotisations: 'personnel payé le mois suivant', stockJours: 'stock (jours)', stock: 'stock cible', mois: 'mois de stock', tolerance: 'écart toléré du stock', avanceExterieur: 'achats de l’Extérieur payés avant (mois)',
  demarque: 'démarque de consignes', ecoulement: 'écoulement d’un fût (mois)', remboursement: 'remboursement des consignes (mois)', operations: 'opérations du réseau',
  ecartCA: 'CA sous le budget', baisseMarge: 'baisse de marge', moisRetard: 'mois de retard', baisseTickets: 'baisse des tickets', baissePanier: 'baisse du panier',
  proposition: 'proposition', retour: 'retour des franchisés', validation: 'validation',
  jeuneMagasin: 'montée en charge (mois)', moisRythme: 'mois du rythme récent', ecartRythme: 'écart du rythme suivi d’office',
  seuilRythme: 'écart du rythme de sortie retenu d’office', magasinsSaisonnalite: 'magasins pour la saisonnalité',
  magasinsCalage: 'magasins pour l’ancienneté', magasinsFamille: 'magasins pour les familles', moisCommerciaux: 'mois des alertes tickets et panier',
}
const MONTANTS = new Set(['plafondTauxReduit', 'smicAnnuel', 'tresorerie'])

function valeur(cle: string, v: unknown): string {
  if (v === undefined || v === null) return 'par défaut'
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v
  if (typeof v === 'number') {
    if (MONTANTS.has(cle)) return montant(v)
    if (cle === 'puissance') return String(v).replace('.', ',')
    return Number.isInteger(v) && Math.abs(v) >= 1 ? String(v) : taux(v)
  }
  if (Array.isArray(v)) return v.length === 0 ? 'aucune' : `${v.length} ligne${v.length > 1 ? 's' : ''}`
  return 'modifiées'
}

// Feuilles qui diffèrent entre deux valeurs : [chemin, avant, après]
function differences(a: unknown, b: unknown, chemin: string[] = []): [string[], unknown, unknown][] {
  const objet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
  if (objet(a) || objet(b)) {
    const oa = objet(a) ? a : {}, ob = objet(b) ? b : {}
    return [...new Set([...Object.keys(oa), ...Object.keys(ob)])].flatMap((k) => differences(oa[k], ob[k], [...chemin, k]))
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [[chemin, a, b]]
}

// Grille des frais (lot 40) : changements ligne par ligne, d'après le code de la ligne (absente : grille par défaut)
function changementsGrille(avant: unknown, apres: unknown): string {
  const a = completerGrille(Array.isArray(avant) ? (avant as LigneGrille[]) : undefined)
  const b = completerGrille(Array.isArray(apres) ? (apres as LigneGrille[]) : undefined)
  const comptes = (l: LigneGrille) => (l.racines.length ? l.racines.join(', ') : 'aucun')
  const c: string[] = []
  for (const l of b) {
    const x = a.find((y) => y.code === l.code)
    if (!x) { c.push(`ligne ajoutée : ${l.libelle}`); continue }
    if (x.libelle !== l.libelle) c.push(`${x.libelle} renommée « ${l.libelle} »`)
    if (x.rubrique !== l.rubrique) c.push(`${l.libelle} : thème ${rubriqueLibelle[x.rubrique]} → ${rubriqueLibelle[l.rubrique]}`)
    if (comptes(x) !== comptes(l)) c.push(`${l.libelle} : comptes ${comptes(x)} → ${comptes(l)}`)
    if (!!x.masquee !== !!l.masquee) c.push(`${l.libelle} ${l.masquee ? 'masquée' : 'réaffichée'}`)
    if (!!x.courante !== !!l.courante) c.push(`${l.libelle} ${l.courante ? 'courante' : 'plus courante'}`)
  }
  if (c.length === 0) return JSON.stringify(a) === JSON.stringify(b) ? 'Aucune valeur changée' : 'Ordre des lignes modifié'
  return c.length > 3 ? `${c.length} changements` : c.join(' ; ')
}

// « 2,0 % → 2,5 % » pour une valeur seule ; « taux réduit : 15,0 % → 16,0 % ; … » pour une rubrique à plusieurs valeurs
export function decrireChangement(rubrique: string, avant: unknown, apres: unknown): string {
  if (rubrique === 'grilleFrais') return changementsGrille(avant, apres)
  // Règles absentes : celles par défaut ; on ne montre que les valeurs qui changent
  if (rubrique === 'regles') { avant = reglesDe({ regles: avant as never }); apres = reglesDe({ regles: apres as never }) }
  const diffs = differences(avant, apres)
  if (diffs.length === 0) return 'Aucune valeur changée'
  if (diffs.length === 1 && diffs[0][0].length === 0) return `${valeur(rubrique, avant)} → ${valeur(rubrique, apres)}`
  if (diffs.length > 3) return `${diffs.length} valeurs modifiées`
  return diffs.map(([c, a, b]) => {
    const cle = c[c.length - 1]
    const libelle = c.length > 1 && c[c.length - 2] === 'achats' ? `consignes ${LIBELLES[cle] ?? cle}` : LIBELLES[cle] ?? cle
    return `${libelle} : ${valeur(cle, a)} → ${valeur(cle, b)}`
  }).join(' ; ')
}

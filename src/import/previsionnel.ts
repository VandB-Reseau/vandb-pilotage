import { lignesFrais } from '../moteur/parametres'
import type { Famille, Flux, Hypotheses, LigneFrais, Rubrique, Univers } from '../moteur/types'
import type { Classeur, Valeur } from './xlsx'

// Base d'un magasin lue dans son prévisionnel Excel (modèle « PREVI 2027 VANDB », un fichier par magasin).
// Seules les saisies du magasin sont reprises : son réalisé, ses salaires, ses frais, ses emprunts.
// Les objectifs (évolutions, marges visées) viennent des niveaux réseau, groupe et magasin de l'app.
// Positions des cellules relevées sur le modèle le 26/10/2026.

export const ONGLETS = { ca: 'ONGLET A PRENDRE EN COMPTE', tb: 'TB mensuel', frais: 'FFBUD', masse: 'Masse salariale mensuelle', financement: 'Tableau de financement' }

export class ModeleInconnu extends Error {
  onglets: string[]
  constructor(onglets: string[]) { super('modèle inconnu'); this.onglets = onglets }
}

export interface ImportPrevisionnel { base: Hypotheses; alertes: string[] }

const NOMS_FAMILLES: Record<string, string> = {
  BIERE: 'Bière', VIN: 'Vin', SPIRITUEUX: 'Spiritueux', 'SANS ALCOOL': 'Sans alcool', ACCESSOIRE: 'Accessoires', FUT: 'Fût',
  ALIMENTAIRE: 'Alimentaire', SOFT: 'Soft', AUTRE: 'Autre', COCKTAIL: 'Cocktail',
}
const nomFamille = (s: string) => NOMS_FAMILLES[s.trim().toUpperCase()] ?? s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase()

// Lignes de l'onglet FFBUD (colonne D : prévisionnel annuel). La publicité franchise (ligne 30) et la redevance (ligne 51)
// sont recalculées par l'app sur le CA.
const LIGNES_FFBUD: Record<number, string> = {
  8: 'energie', 9: 'carburant', 10: 'petit_equipement', 11: 'vetements', 12: 'fournitures', 13: 'credit_bail', 14: 'loyer',
  15: 'locations_mobilieres', 16: 'charges_locatives', 17: 'entretien_immobilier', 18: 'entretien_materiel', 19: 'maintenance',
  20: 'assurances', 21: 'documentation', 22: 'personnel_exterieur', 23: 'honoraires_comptables', 24: 'honoraires_social',
  25: 'honoraires_divers', 26: 'honoraires_juridiques', 27: 'honoraires_holding', 28: 'actes', 29: 'livraison', 31: 'publicite_locale',
  32: 'transports_achats', 33: 'deplacements', 34: 'receptions', 35: 'telecom', 36: 'banque', 37: 'cotisations', 38: 'formations',
  40: 'formation_continue', 41: 'apprentissage', 42: 'cfe', 43: 'taxes_foncieres', 44: 'enregistrement', 45: 'taxes_diverses',
  46: 'csg_gerance', 47: 'csg_autres', 52: 'droits_auteur', 53: 'charges_diverses',
}
const IMPOTS_HORS_GRILLE: Record<string, string> = {
  formation_continue: 'Participation à la formation continue', apprentissage: 'Taxe d’apprentissage',
  csg_gerance: 'CSG déductible de la gérance', csg_autres: 'CSG déductible, autres',
}

// Colonnes des 12 mois dans l'onglet TB mensuel
const MOIS_TB = ['B', 'D', 'H', 'L', 'P', 'T', 'Y', 'AC', 'AG', 'AK', 'AO', 'AS']
const MOIS_CA = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']

export function lirePrevisionnel(classeur: Classeur, annee: number): ImportPrevisionnel {
  const manquants = Object.values(ONGLETS).filter((o) => !classeur.has(o))
  if (manquants.length) throw new ModeleInconnu(manquants)
  const alertes: string[] = []
  const val = (onglet: string, ref: string): Valeur | undefined => classeur.get(onglet)?.get(ref)
  const nb = (onglet: string, ref: string): number => { const v = val(onglet, ref); return typeof v === 'number' && Number.isFinite(v) ? v : 0 }
  const txt = (onglet: string, ref: string): string => { const v = val(onglet, ref); return typeof v === 'string' ? v : '' }
  const { ca, tb, frais: ff, masse, financement } = ONGLETS

  // « CA MAG HT 2026 AU 31/08 » : le mois de la date donne le nombre de mois réalisés
  const date = txt(ca, 'A2').match(/(\d{1,2})\/(\d{1,2})/)
  const moisRealises = date ? Math.min(11, Math.max(1, Number(date[2]))) : 8
  if (!date) alertes.push('Date d’arrêté du réalisé introuvable : 8 mois réalisés retenus (fin août).')

  const caMensuelReference = MOIS_CA.map((c) => nb(ca, `${c}33`))
  if (caMensuelReference.some((v) => v <= 0)) alertes.push('CA mensuel de référence incomplet : la saisonnalité est répartie au mieux.')

  const familles: Famille[] = []
  const ajouter = (univers: Univers, lignes: number[]) => {
    for (const r of lignes) {
      const nom = txt(ca, `A${r}`)
      const caRealise = nb(ca, `B${r}`)
      if (!nom || caRealise <= 0) continue
      const marge = nb(ca, `J${r}`) || nb(ca, `K${r}`)
      if (!nb(ca, `J${r}`)) alertes.push(`Marge réalisée absente pour ${nomFamille(nom)} : marge réseau reprise.`)
      familles.push({ univers, famille: univers === 'exterieur' ? 'Factures' : nomFamille(nom), caRealise, margeRealisee: marge, evolution: 0, margeCible: marge })
    }
  }
  ajouter('cave', [4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  ajouter('bar', [15, 16, 17, 18, 19, 20, 21, 22, 23, 24])
  ajouter('exterieur', [25])
  if (!familles.length) alertes.push('Aucun CA réalisé par famille.')

  // Part du CA réalisée : saisie dans le fichier corrigé (G29, H29), et pour l'extérieur F29 (part N-1 à la même date)
  const partRealisee: Hypotheses['partRealisee'] = {}
  if (nb(ca, 'G29') > 0 && nb(ca, 'G29') < 1) partRealisee.cave = nb(ca, 'G29')
  if (nb(ca, 'H29') > 0 && nb(ca, 'H29') < 1) partRealisee.bar = nb(ca, 'H29')
  if (nb(ca, 'F29') > 0 && nb(ca, 'F29') < 1) partRealisee.exterieur = nb(ca, 'F29')

  const flux: Hypotheses['flux'] = {}
  const lireFlux = (realise: string, evolution: string, panier: string): Flux | undefined =>
    nb(ca, realise) > 0 ? { realise: nb(ca, realise), evolution: nb(ca, evolution), panierCibleTTC: nb(ca, panier) } : undefined
  const fluxCave = lireFlux('F3', 'P4', 'Q3')
  const fluxBar = lireFlux('F14', 'P15', 'Q14')
  if (fluxCave) flux.cave = fluxCave
  if (fluxBar) flux.bar = fluxBar

  // Masse salariale : la ligne du compte de résultat mensuel (TB mensuel) fait foi, comme dans le fichier corrigé
  const salairesMensuels = MOIS_TB.map((c) => nb(tb, `${c}61`) + nb(tb, `${c}62`) + nb(tb, `${c}65`))
  const remunerationGerance = nb(tb, 'B63')
  const tauxCotisationsGerance = remunerationGerance > 0 && nb(tb, 'B64') > 0 ? nb(tb, 'B64') / remunerationGerance : 0.5
  const heures = nb(masse, 'C17')
  if (!heures) alertes.push('Heures travaillées absentes : le CA par heure ne sera pas calculé.')

  const grille = new Map(lignesFrais.map((l) => [l.code, l]))
  const frais: LigneFrais[] = []
  for (const [ligne, code] of Object.entries(LIGNES_FFBUD)) {
    const r = Number(ligne)
    const modele = grille.get(code)
    const rubrique: Rubrique = modele?.rubrique ?? 'impots_taxes'
    const libelle = modele?.libelle ?? IMPOTS_HORS_GRILLE[code] ?? txt(ff, `A${r}`)
    if (code === 'energie') {
      const taux = nb(tb, 'T5')
      if (taux > 0) frais.push({ code, libelle, rubrique, tauxCA: taux })
      else if (nb(ff, `D${r}`)) frais.push({ code, libelle, rubrique, annuel: nb(ff, `D${r}`) })
      continue
    }
    const annuel = nb(ff, `D${r}`)
    if (annuel) frais.push({ code, libelle, rubrique, annuel })
  }

  return {
    base: {
      annee, moisRealises, caMensuelReference, partRealisee, familles, flux,
      personnel: { salairesMensuels, remunerationGerance, tauxCotisationsGerance, heuresMensuelles: Array(12).fill(heures) },
      frais,
      amortissements: nb(ff, 'D49'),
      interets: nb(ff, 'D55') + nb(ff, 'D56') + nb(ff, 'D57'),
      remboursementCapital: nb(financement, 'F19'),
      deficitReportable: nb(financement, 'N20'),
    },
    alertes,
  }
}

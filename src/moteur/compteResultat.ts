import { blocDe, LIGNES_SUR_CA, lignesFrais, rubriqueLibelle } from './parametres'
import { UNIVERS, universLibelle, type Budget, type Hypotheses } from './types'

// Compte de résultat sur 12 mois, ligne par ligne, prêt à afficher : rubriques dépliables (détail par univers ou par ligne de frais).
// Montants en charge négatifs. L'impôt sur les sociétés et ce qui en découle ne sont calculés que sur l'année.
export interface LigneCompte {
  cle: string
  libelle: string
  mois: (number | null)[]   // 12 valeurs ; null quand le montant n'a de sens que sur l'année
  total: number
  fort?: boolean            // sous-total (marge, EBE, résultat)
  parent?: string           // ligne de détail, repliée sous sa rubrique
  indicateur?: boolean      // ligne de lecture (CA par heure) : ni part du CA, ni signe de charge
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const negatif = (l: number[]) => l.map((v) => -v)

export function compteResultat(b: Budget, h: Hypotheses, p: { tauxRedevance: number; tauxPublicite: number }): LigneCompte[] {
  const ca = b.mois.map((m) => m.ca)
  const ligne = (cle: string, libelle: string, mois: number[], o: Partial<LigneCompte> = {}): LigneCompte => ({ cle, libelle, mois, total: somme(mois), ...o })

  // Détail du CA par univers : objectif de chaque univers réparti comme le CA du mois (saisonnalité et travaux)
  const parUnivers = UNIVERS
    .map((u) => ({ u, objectif: somme(b.familles.filter((f) => f.univers === u).map((f) => f.objectif)) }))
    .filter((x) => x.objectif > 0)
    .map((x) => ligne(`ca/${x.u}`, universLibelle[x.u], ca.map((c) => (b.ca ? x.objectif * c / b.ca : 0)), { parent: 'ca' }))

  const montantFrais = (l: Hypotheses['frais'][number]) => ca.map((c) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))
  // Lignes de frais dans l'ordre et les blocs de l'onglet FFBUD (lot 23) ; les autres charges restent au-dessus de l'EBE
  const rang = (code: string) => { const i = lignesFrais.findIndex((g) => g.code === code); return i < 0 ? 999 : i }
  const dansBloc = (b: ReturnType<typeof blocDe>) => h.frais.filter((l) => blocDe(l) === b).sort((x, y) => rang(x.code) - rang(y.code))
  const externes = dansBloc('charges_externes')
  const impots = dansBloc('impots_taxes')
  const autres = dansBloc('autres_charges')
  const totalAutres = autres.reduce((t, l) => t.map((v, i) => v + montantFrais(l)[i]), Array(12).fill(0) as number[])
  const detailFrais = (l: Hypotheses['frais'][number], parent: string) =>
    ligne(`${parent}/${l.code}`, l.libelle || rubriqueLibelle[l.rubrique], negatif(montantFrais(l)), { parent })

  const amort = Array(12).fill(-b.amortissements / 12)
  const interets = Array(12).fill(-h.interets / 12)
  const annuel = (cle: string, libelle: string, total: number, o: Partial<LigneCompte> = {}): LigneCompte => ({ cle, libelle, mois: Array(12).fill(null), total, ...o })

  return [
    ligne('ca', 'Chiffre d’affaires HT', ca, { fort: true }),
    ...(parUnivers.length > 1 ? parUnivers : []),
    ligne('achats', 'Achats consommés HT', negatif(b.mois.map((m) => m.achats))),
    ligne('marge', 'Marge commerciale', b.mois.map((m) => m.marge), { fort: true }),
    ligne('externes', 'Charges externes', negatif(b.mois.map((m, i) => m.chargesExternes - totalAutres[i]))),
    ...externes.map((l) => detailFrais(l, 'externes')),
    ligne('externes/publicite', LIGNES_SUR_CA.publicite.libelle, negatif(ca.map((c) => c * p.tauxPublicite)), { parent: 'externes' }),
    ligne('externes/redevance', LIGNES_SUR_CA.redevance.libelle, negatif(ca.map((c) => c * p.tauxRedevance)), { parent: 'externes' }),
    ligne('impots', 'Impôts et taxes', negatif(b.mois.map((m) => m.impotsTaxes))),
    ...impots.map((l) => detailFrais(l, 'impots')),
    ...(autres.length ? [ligne('autres', 'Autres charges', negatif(totalAutres)), ...autres.map((l) => detailFrais(l, 'autres'))] : []),
    ligne('personnel', 'Frais de personnel', negatif(b.mois.map((m) => m.personnel))),
    ligne('ebe', 'Excédent brut d’exploitation', b.mois.map((m) => m.ebe), { fort: true }),
    ligne('amortissements', 'Dotations aux amortissements', amort),
    ligne('exploitation', 'Résultat d’exploitation', b.mois.map((m) => m.resultatExploitation), { fort: true }),
    ligne('interets', 'Intérêts et charges assimilées', interets),
    ligne('avant_impot', 'Résultat avant impôt', b.mois.map((m) => m.resultatAvantImpot)),
    annuel('impot', 'Impôt sur les sociétés', -b.impot),
    annuel('net', 'Résultat net', b.resultatNet, { fort: true }),
    annuel('tresorerie', 'Trésorerie dégagée après emprunts', b.tresorerieDegagee),
    ...productivite(b),
  ]
}

// CA par heure travaillée : par mois, et sur l'année CA total / heures totales (pas la moyenne des mois)
function productivite(b: Budget): LigneCompte[] {
  const heures = b.mois.map((m) => (m.productivite ? m.ca / m.productivite : 0))
  const total = somme(heures)
  if (!total) return []
  return [{ cle: 'productivite', libelle: 'CA par heure travaillée', mois: b.mois.map((m) => m.productivite), total: b.ca / total, indicateur: true }]
}

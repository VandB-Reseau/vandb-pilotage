import { rubriqueLibelle } from './parametres'
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

  // Détail du CA par univers : objectif de chaque univers réparti selon les poids mensuels
  const parUnivers = UNIVERS
    .map((u) => ({ u, objectif: somme(b.familles.filter((f) => f.univers === u).map((f) => f.objectif)) }))
    .filter((x) => x.objectif > 0)
    .map((x) => ligne(`ca/${x.u}`, universLibelle[x.u], b.poids.map((w) => x.objectif * w), { parent: 'ca' }))

  const montantFrais = (l: Hypotheses['frais'][number]) => ca.map((c) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))
  const externes = h.frais.filter((l) => l.rubrique !== 'impots_taxes')
  const impots = h.frais.filter((l) => l.rubrique === 'impots_taxes')
  const detailFrais = (l: Hypotheses['frais'][number], parent: string) =>
    ligne(`${parent}/${l.code}`, l.libelle || rubriqueLibelle[l.rubrique], negatif(montantFrais(l)), { parent })

  const amort = Array(12).fill(-h.amortissements / 12)
  const interets = Array(12).fill(-h.interets / 12)
  const annuel = (cle: string, libelle: string, total: number, o: Partial<LigneCompte> = {}): LigneCompte => ({ cle, libelle, mois: Array(12).fill(null), total, ...o })

  return [
    ligne('ca', 'Chiffre d’affaires HT', ca, { fort: true }),
    ...(parUnivers.length > 1 ? parUnivers : []),
    ligne('achats', 'Achats consommés HT', negatif(b.mois.map((m) => m.achats))),
    ligne('marge', 'Marge commerciale', b.mois.map((m) => m.marge), { fort: true }),
    ligne('externes', 'Charges externes', negatif(b.mois.map((m) => m.chargesExternes))),
    ligne('externes/redevance', 'Redevance', negatif(ca.map((c) => c * p.tauxRedevance)), { parent: 'externes' }),
    ligne('externes/publicite', 'Publicité', negatif(ca.map((c) => c * p.tauxPublicite)), { parent: 'externes' }),
    ...externes.map((l) => detailFrais(l, 'externes')),
    ligne('impots', 'Impôts et taxes', negatif(b.mois.map((m) => m.impotsTaxes))),
    ...impots.map((l) => detailFrais(l, 'impots')),
    ligne('personnel', 'Frais de personnel', negatif(b.mois.map((m) => m.personnel))),
    ligne('ebe', 'Excédent brut d’exploitation', b.mois.map((m) => m.ebe), { fort: true }),
    ligne('amortissements', 'Dotations aux amortissements', amort),
    ligne('exploitation', 'Résultat d’exploitation', b.mois.map((m) => m.resultatExploitation), { fort: true }),
    ligne('interets', 'Intérêts d’emprunts', interets),
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

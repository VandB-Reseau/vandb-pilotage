import { financementDe } from './financement'
import { blocDe, grilleDe, LIGNES_SUR_CA, rangDans, rubriqueLibelle, THEMES_FRAIS } from './parametres'
import type { LigneGrille } from './types'
import { UNIVERS, universLibelle, type Budget, type Hypotheses } from './types'

// Compte de résultat sur 12 mois, ligne par ligne, prêt à afficher : rubriques dépliables (détail par univers ou par ligne de frais).
// Montants en charge négatifs. L'impôt sur les sociétés se calcule sur l'année ; chaque mois en porte sa part, au prorata de son
// résultat avant impôt (29/10/2026, Joseph : résultat net mois par mois). Sous le résultat net, le capital des emprunts
// remboursé et les amortissements réintégrés mènent à la trésorerie dégagée du mois.
export interface LigneCompte {
  cle: string
  libelle: string
  mois: (number | null)[]   // 12 valeurs ; null quand le montant n'a de sens que sur l'année
  total: number
  fort?: boolean            // sous-total (marge, EBE, résultat)
  parent?: string           // ligne de détail, repliée sous sa rubrique
  indicateur?: boolean      // ligne de lecture (CA par heure) : ni part du CA, ni signe de charge
  heures?: boolean          // ligne en heures, pas en euros
}

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const negatif = (l: number[]) => l.map((v) => -v)

export function compteResultat(b: Budget, h: Hypotheses, p: { tauxRedevance: number; tauxPublicite: number; grilleFrais?: LigneGrille[] }): LigneCompte[] {
  const grille = grilleDe(p)
  const ca = b.mois.map((m) => m.ca)
  const ligne = (cle: string, libelle: string, mois: number[], o: Partial<LigneCompte> = {}): LigneCompte => ({ cle, libelle, mois, total: somme(mois), ...o })

  // Détail du CA par univers : celui du mois quand le moteur le donne (temps forts dans leur mois, lot 24), sinon
  // l'objectif de chaque univers réparti comme le CA du mois (saisonnalité et travaux)
  const parUnivers = UNIVERS
    .map((u) => ({ u, objectif: somme(b.familles.filter((f) => f.univers === u).map((f) => f.objectif)) }))
    .filter((x) => x.objectif > 0)
    .map((x) => ligne(`ca/${x.u}`, universLibelle[x.u], ca.map((c, i) => b.mois[i].univers?.[x.u].ca ?? (b.ca ? x.objectif * c / b.ca : 0)), { parent: 'ca' }))

  const montantFrais = (l: Hypotheses['frais'][number]) => ca.map((c) => (l.annuel ?? 0) / 12 + c * (l.tauxCA ?? 0))
  // Lignes de frais dans l'ordre et les blocs de l'onglet FFBUD (lot 23) ; les autres charges restent au-dessus de l'EBE
  const rang = rangDans(grille)
  const dansBloc = (b: ReturnType<typeof blocDe>) => h.frais.filter((l) => blocDe(l, grille) === b).sort((x, y) => rang(x.code) - rang(y.code))
  const externes = dansBloc('charges_externes')
  const impots = dansBloc('impots_taxes')
  const autres = dansBloc('autres_charges')
  const totalAutres = autres.reduce((t, l) => t.map((v, i) => v + montantFrais(l)[i]), Array(12).fill(0) as number[])
  const detailFrais = (l: Hypotheses['frais'][number], prefixe: string, parent = prefixe) =>
    ligne(`${prefixe}/${l.code}`, l.libelle || rubriqueLibelle[l.rubrique], negatif(montantFrais(l)), { parent })

  // Lot 35 (Joseph, 02/11/2026 : « les frais classés partout ») : charges externes détaillées par thème, comme l'onglet
  // Frais, puis ligne par ligne sous chaque thème
  const themesExternes = THEMES_FRAIS.flatMap((r) => {
    const dans = externes.filter((l) => l.rubrique === r)
    if (!dans.length) return []
    const cle = `externes/theme/${r}`
    const total = dans.reduce((t, l) => t.map((v, i) => v + montantFrais(l)[i]), Array(12).fill(0) as number[])
    return [ligne(cle, rubriqueLibelle[r], negatif(total), { parent: 'externes' }), ...dans.map((l) => detailFrais(l, 'externes', cle))]
  })

  const fin = b.financement ?? financementDe(h, 0)
  const amort = Array(12).fill(-b.amortissements / 12)
  const interets = negatif(fin.interetsMois)
  // Impôt du mois : part de l'impôt de l'année au prorata du résultat avant impôt (somme des mois = impôt de l'année)
  const rai = b.mois.map((m) => m.resultatAvantImpot)
  const totalRai = somme(rai)
  const impotMois = rai.map((r) => (totalRai ? b.impot * r / totalRai : b.impot / 12))
  const net = rai.map((r, i) => r - impotMois[i])
  const capital = negatif(fin.capitalMois)
  const reintegres = Array(12).fill(b.amortissements / 12)
  // Charges des événements (temps forts), comprises dans les charges externes du mois
  const evenements = b.mois.map((m) => m.autresChargesTempsForts ?? 0)

  return [
    ligne('ca', 'Chiffre d’affaires HT', ca, { fort: true }),
    ...(parUnivers.length > 1 ? parUnivers : []),
    ligne('achats', 'Achats consommés HT', negatif(b.mois.map((m) => m.achats))),
    ligne('marge', 'Marge commerciale', b.mois.map((m) => m.marge), { fort: true }),
    ligne('externes', 'Charges externes', negatif(b.mois.map((m, i) => m.chargesExternes - totalAutres[i]))),
    ...themesExternes,
    ...externes.filter((l) => !THEMES_FRAIS.includes(l.rubrique)).map((l) => detailFrais(l, 'externes')),
    ligne('externes/theme/reseau', 'Redevances du réseau', negatif(ca.map((c) => c * (p.tauxPublicite + p.tauxRedevance))), { parent: 'externes' }),
    ligne('externes/publicite', LIGNES_SUR_CA.publicite.libelle, negatif(ca.map((c) => c * p.tauxPublicite)), { parent: 'externes/theme/reseau' }),
    ligne('externes/redevance', LIGNES_SUR_CA.redevance.libelle, negatif(ca.map((c) => c * p.tauxRedevance)), { parent: 'externes/theme/reseau' }),
    ...(evenements.some((v) => v) ? [ligne('externes/evenements', 'Charges des événements', negatif(evenements), { parent: 'externes' })] : []),
    ...(b.mois.some((m) => m.demarqueConsignes) ? [ligne('externes/consignes', 'Démarque de consignes', negatif(b.mois.map((m) => m.demarqueConsignes ?? 0)), { parent: 'externes' })] : []),
    ligne('impots', 'Impôts et taxes', negatif(b.mois.map((m) => m.impotsTaxes))),
    ...impots.map((l) => detailFrais(l, 'impots')),
    ...(autres.length ? [ligne('autres', 'Autres charges', negatif(totalAutres)), ...autres.map((l) => detailFrais(l, 'autres'))] : []),
    ligne('personnel', 'Frais de personnel', negatif(b.mois.map((m) => m.personnel))),
    ligne('ebe', 'Excédent brut d’exploitation', b.mois.map((m) => m.ebe), { fort: true }),
    ligne('amortissements', 'Dotations aux amortissements', amort),
    ligne('exploitation', 'Résultat d’exploitation', b.mois.map((m) => m.resultatExploitation), { fort: true }),
    ligne('interets', 'Intérêts et charges assimilées', interets),
    ligne('avant_impot', 'Résultat avant impôt', b.mois.map((m) => m.resultatAvantImpot)),
    ligne('impot', 'Impôt sur les sociétés', negatif(impotMois)),
    ligne('net', 'Résultat net', net, { fort: true }),
    ...(b.amortissements ? [ligne('reintegres', 'Amortissements réintégrés', reintegres)] : []),
    ...(capital.some((v) => v) ? [ligne('capital', 'Capital des emprunts remboursé', capital)] : []),
    ligne('tresorerie', 'Trésorerie dégagée après emprunts', net.map((v, i) => v + reintegres[i] + capital[i]), { fort: true }),
    ...productivite(b),
  ]
}

// CA par heure travaillée : par mois, et sur l'année CA total / heures totales (pas la moyenne des mois)
function productivite(b: Budget): LigneCompte[] {
  const heures = b.mois.map((m) => (m.productivite ? m.ca / m.productivite : 0))
  const total = somme(heures)
  if (!total) return []
  return [
    { cle: 'heures', libelle: 'Heures travaillées', mois: heures, total, indicateur: true, heures: true },
    { cle: 'productivite', libelle: 'CA par heure travaillée', mois: b.mois.map((m) => m.productivite), total: b.ca / total, indicateur: true },
  ]
}

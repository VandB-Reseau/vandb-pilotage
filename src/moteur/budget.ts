import { UNIVERS, type Budget, type Hypotheses, type Mois, type ParametresReseau, type ResultatFamille, type Univers } from './types'

// Moteur du budget annuel d'un magasin. Fonction pure : le même calcul sert à l'écran, au simulateur et aux tests.
// Il corrige les biais du prévisionnel Excel 2027 (constats du 26/10/2026) :
// - année de 12 mois : atterrissage = réalisé / part du CA réalisée à la même date (plus de « 13e mois ») ;
// - poids mensuels qui totalisent toujours 100 % ;
// - achats comptés HT dans le compte de résultat (le TTC ne concerne que la trésorerie) ;
// - redevance et publicité en % du CA HT, au-dessus de l'EBE ;
// - impôt sur les sociétés calculé.

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const ratio = (a: number, b: number) => (b ? a / b : 0)

export function poidsMensuels(reference: number[]): number[] {
  const total = somme(reference)
  if (reference.length !== 12 || total <= 0) return Array(12).fill(1 / 12)
  return reference.map((v) => v / total)
}

// Part du CA annuel réalisée à la fin du mois « moisRealises », d'après le CA de référence
export function partRealiseeReference(reference: number[], moisRealises: number): number {
  const poids = poidsMensuels(reference)
  return somme(poids.slice(0, Math.max(0, Math.min(12, moisRealises))))
}

export function impotSocietes(resultat: number, deficit: number, p: ParametresReseau['impot']): number {
  const base = Math.max(0, resultat - Math.max(0, deficit))
  return Math.min(base, p.plafondTauxReduit) * p.tauxReduit + Math.max(0, base - p.plafondTauxReduit) * p.tauxNormal
}

export function calculerBudget(h: Hypotheses, p: ParametresReseau): Budget {
  const partDefaut = partRealiseeReference(h.caMensuelReference, h.moisRealises)
  const partRealisee = Object.fromEntries(UNIVERS.map((u) => [u, h.partRealisee?.[u] || partDefaut])) as Record<Univers, number>

  const familles: ResultatFamille[] = h.familles.map((f) => {
    const atterrissage = ratio(f.caRealise, partRealisee[f.univers])
    const objectif = atterrissage * (1 + f.evolution)
    return { ...f, atterrissage, objectif, margeObjectif: objectif * f.margeCible }
  })
  const atterrissage = somme(familles.map((f) => f.atterrissage))
  const ca = somme(familles.map((f) => f.objectif))
  const marge = somme(familles.map((f) => f.margeObjectif))
  const tauxMarge = ratio(marge, ca)
  const poids = poidsMensuels(h.caMensuelReference)
  const g = h.personnel

  const mois: Mois[] = poids.map((w, i) => {
    const caMois = ca * w
    const margeMois = caMois * tauxMarge
    let externes = caMois * (p.tauxRedevance + p.tauxPublicite)
    let impots = 0
    for (const l of h.frais) {
      const montant = (l.annuel ?? 0) / 12 + caMois * (l.tauxCA ?? 0)
      if (l.rubrique === 'impots_taxes') impots += montant
      else externes += montant
    }
    const personnel = (g.salairesMensuels[i] ?? 0) + g.remunerationGerance * (1 + g.tauxCotisationsGerance)
    const ebe = margeMois - externes - impots - personnel
    const resultatExploitation = ebe - h.amortissements / 12
    const heures = g.heuresMensuelles[i] ?? 0
    return {
      ca: caMois, achats: caMois - margeMois, marge: margeMois, chargesExternes: externes, impotsTaxes: impots, personnel, ebe,
      resultatExploitation, resultatAvantImpot: resultatExploitation - h.interets / 12, productivite: heures > 0 ? caMois / heures : null,
    }
  })

  const total = (k: keyof Omit<Mois, 'productivite'>) => somme(mois.map((m) => m[k]))
  const personnel = total('personnel')
  const ebe = total('ebe')
  const resultatAvantImpot = total('resultatAvantImpot')
  const impot = impotSocietes(resultatAvantImpot, h.deficitReportable, p.impot)
  const resultatNet = resultatAvantImpot - impot
  const capaciteAutofinancement = resultatNet + h.amortissements

  const flux: Budget['flux'] = {}
  for (const u of ['cave', 'bar'] as const) {
    const f = h.flux?.[u]
    if (!f) continue
    const fluxAtterri = ratio(f.realise, partRealisee[u])
    const objectif = fluxAtterri * (1 + f.evolution)
    flux[u] = { atterrissage: fluxAtterri, objectif, caParPanier: objectif * f.panierCibleTTC / (1 + p.tvaPanier[u]) }
  }

  return {
    familles, partRealisee, atterrissage, ca, marge, tauxMarge, poids, mois,
    redevance: ca * p.tauxRedevance, publicite: ca * p.tauxPublicite,
    chargesExternes: total('chargesExternes'), impotsTaxes: total('impotsTaxes'), personnel, ebe,
    resultatExploitation: total('resultatExploitation'), resultatAvantImpot, impot, resultatNet, capaciteAutofinancement,
    tresorerieDegagee: capaciteAutofinancement - h.remboursementCapital,
    ratios: { personnelSurMarge: ratio(personnel, marge), personnelSurCA: ratio(personnel, ca), ebeSurCA: ratio(ebe, ca) },
    flux,
  }
}

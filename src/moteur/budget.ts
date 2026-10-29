import { masseSalariale } from './equipe'
import { SEUIL_RYTHME } from './projection'
import { UNIVERS, type Budget, type DetailCAUnivers, type Hypotheses, type Mois, type ParametresReseau, type ResultatFamille, type RythmeSortie, type TempsFort, type Travaux, type Univers } from './types'

// Moteur du budget annuel d'un magasin. Fonction pure : le même calcul sert à l'écran, au simulateur et aux tests.
// Il corrige les biais du prévisionnel Excel 2027 (constats du 26/10/2026) :
// - année de 12 mois : atterrissage = réalisé / part du CA réalisée à la même date (plus de « 13e mois ») ;
// - poids mensuels qui totalisent toujours 100 % ;
// - achats comptés HT dans le compte de résultat (le TTC ne concerne que la trésorerie) ;
// - redevance et publicité en % du CA HT, au-dessus de l'EBE ;
// - impôt sur les sociétés calculé.
// Lot 24 : base de chaque univers hors temps forts de l'an passé, rythme de sortie pour la Cave et le Bar, temps forts et
// ajustements datés ajoutés dans leur mois, avec leurs charges propres.

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

// Saisonnalité du budget : celle propre au magasin si elle est saisie (ramenée à 100 %), sinon celle du CA de référence
export function poidsBudget(h: Pick<Hypotheses, 'poidsMois' | 'caMensuelReference'>): number[] {
  const p = h.poidsMois
  if (p?.length === 12 && p.every((v) => Number.isFinite(v) && v >= 0) && somme(p) > 0) return p.map((v) => v / somme(p))
  return poidsMensuels(h.caMensuelReference)
}

// Effet des travaux : activité de chaque mois (gain de CA appliqué après le dernier mois touché) et dotation de l'année,
// l'investissement s'amortissant à partir du mois de réouverture
export function effetTravaux(t: Travaux | undefined): { activite: number[]; dotation: number } {
  if (!t || t.activite?.length !== 12) return { activite: Array(12).fill(1), dotation: 0 }
  const activite = t.activite.map((a) => Math.min(1, Math.max(0, Number.isFinite(a) ? a : 1)))
  const dernier = activite.reduce((d, a, i) => (a < 1 ? i : d), -1)
  const gain = Math.max(0, t.gain || 0)
  const moisApres = dernier < 0 ? 12 : 11 - dernier
  return {
    activite: activite.map((a, i) => (dernier >= 0 && i > dernier ? a * (1 + gain) : a)),
    dotation: t.dureeAmortissement > 0 ? Math.max(0, t.investissement || 0) / t.dureeAmortissement * moisApres / 12 : 0,
  }
}

// Mix des familles d'un univers : les parts visées restent telles quelles (ramenées à 100 % si elles le dépassent),
// les autres familles se partagent le reste au prorata de leur CA atterri
export function mix(familles: { part?: number; poids: number }[]): number[] {
  const fixees = familles.map((f) => (Number.isFinite(f.part) && f.part! >= 0 ? f.part! : null))
  const totalFixe = somme(fixees.map((x) => x ?? 0))
  const libres = familles.filter((_, i) => fixees[i] === null)
  const poidsLibres = somme(libres.map((f) => Math.max(0, f.poids)))
  if (totalFixe >= 1 || !libres.length) return totalFixe > 0 ? fixees.map((x) => (x ?? 0) / totalFixe) : familles.map(() => 1 / familles.length)
  const reste = 1 - totalFixe
  return familles.map((f, i) => fixees[i] ?? (poidsLibres > 0 ? reste * Math.max(0, f.poids) / poidsLibres : reste / libres.length))
}

export function impotSocietes(resultat: number, deficit: number, p: ParametresReseau['impot']): number {
  const base = Math.max(0, resultat - Math.max(0, deficit))
  return Math.min(base, p.plafondTauxReduit) * p.tauxReduit + Math.max(0, base - p.plafondTauxReduit) * p.tauxNormal
}

const moisValide = (m: number) => Number.isInteger(m) && m >= 1 && m <= 12
const tempsFortsValides = (l: TempsFort[] | undefined) => (l ?? []).filter((t) => moisValide(t.mois) && UNIVERS.includes(t.univers))

export function calculerBudget(h: Hypotheses, p: ParametresReseau): Budget {
  const partDefaut = partRealiseeReference(h.caMensuelReference, h.moisRealises)
  const partRealisee = Object.fromEntries(UNIVERS.map((u) => [u, h.partRealisee?.[u] || partDefaut])) as Record<Univers, number>

  const poids = poidsBudget(h)
  const travaux = effetTravaux(h.travaux)
  // Part de l'année réellement ouverte (fermetures, activité réduite, gain après réouverture) : s'applique à chaque famille
  const ouverture = somme(poids.map((w, i) => w * travaux.activite[i]))

  const atterries = h.familles.map((f) => ratio(f.caRealise, partRealisee[f.univers]))
  const dansU = (u: Univers) => h.familles.map((f, i) => (f.univers === u ? i : -1)).filter((i) => i >= 0)
  const atterriU = (u: Univers) => somme(dansU(u).map((i) => atterries[i]))

  // Temps forts de l'an passé déjà réalisés : sortis du réalisé avant d'en tirer l'atterrissage, (réalisé − temps forts) / part
  const tempsForts = tempsFortsValides(h.tempsForts)
  const passes = (u: Univers, de = 1, a = h.moisRealises) => somme(tempsForts.filter((t) => t.univers === u && t.mois >= de && t.mois <= Math.min(a, h.moisRealises)).map((t) => Math.max(0, t.caAnPasse || 0)))
  const horsTempsForts = Object.fromEntries(UNIVERS.map((u) => {
    const realise = somme(dansU(u).map((i) => h.familles[i].caRealise))
    return [u, realise > 0 ? atterriU(u) * Math.max(0, 1 - passes(u) / realise) : atterriU(u)]
  })) as Record<Univers, number>

  // Base de chaque univers, en multiple de son atterrissage : hors temps forts, ou rythme de sortie quand il est retenu
  const facteur = Object.fromEntries(UNIVERS.map((u) => [u, atterriU(u) > 0 ? horsTempsForts[u] / atterriU(u) : 1])) as Record<Univers, number>
  const sortie: Budget['sortie'] = {}
  for (const u of ['cave', 'bar'] as const) {
    const s = h.sortie?.[u]
    if (!h.rythme || !s || !(s.poids > 0) || !(horsTempsForts[u] > 0)) continue
    const annuel = Math.max(0, s.ca - passes(u, s.de, s.a)) / s.poids
    const acquis = annuel / horsTempsForts[u] - 1
    const choix = h.rythme[u] ?? 'auto'
    const statut: RythmeSortie['statut'] = choix === 'ignore' ? 'ignore' : choix === 'applique' || Math.abs(acquis) <= SEUIL_RYTHME + 1e-9 ? 'applique' : 'a_confirmer'
    if (statut === 'applique') facteur[u] = annuel / atterriU(u)
    sortie[u] = { atterri: horsTempsForts[u], annuel, acquis, de: s.de, a: s.a, statut }
  }

  // Cave et Bar avec leurs tickets : CA de l'univers = base × (1 + évolution des tickets) × (1 + évolution du panier),
  // réparti entre les familles selon le mix visé ; sinon, famille par famille avec son évolution
  const flux: Budget['flux'] = {}
  const objectifs = h.familles.map((f, i) => atterries[i] * facteur[f.univers] * (1 + f.evolution) * ouverture)
  for (const u of ['cave', 'bar'] as const) {
    const fl = h.flux?.[u]
    if (!fl || !(fl.realise > 0)) continue
    const ticketsAtterris = ratio(fl.realise, partRealisee[u])
    if (!h.caParTickets) {
      flux[u] = { atterrissage: ticketsAtterris, objectif: ticketsAtterris * (1 + fl.evolution), evolution: fl.evolution, panierRealiseTTC: fl.panierCibleTTC, panierObjectifTTC: fl.panierCibleTTC, evolutionPanier: 0, caAtterri: 0, ca: 0, parTickets: false }
      continue
    }
    const dans = dansU(u)
    const caAtterri = atterriU(u)
    const evolutionPanier = fl.evolutionPanier ?? 0
    const caU = caAtterri * facteur[u] * (1 + fl.evolution) * (1 + evolutionPanier) * ouverture
    const parts = mix(dans.map((i) => ({ part: h.familles[i].part, poids: atterries[i] })))
    dans.forEach((i, k) => { objectifs[i] = caU * parts[k] })
    flux[u] = {
      atterrissage: ticketsAtterris, objectif: ticketsAtterris * facteur[u] * (1 + fl.evolution) * ouverture, evolution: fl.evolution,
      panierRealiseTTC: fl.panierCibleTTC, panierObjectifTTC: fl.panierCibleTTC * (1 + evolutionPanier), evolutionPanier,
      caAtterri, ca: caU, parTickets: true,
    }
  }

  // Temps forts du budget et ajustements datés, univers par univers et mois par mois (en plus de la saisonnalité)
  const base = Object.fromEntries(UNIVERS.map((u) => [u, somme(dansU(u).map((i) => objectifs[i]))])) as Record<Univers, number>
  // Saisonnalité de chaque univers (29/10/2026) quand la base la donne et que le magasin n'a pas réglé la sienne ;
  // le total de l'univers ne change pas, seule sa répartition dans l'année
  const propre = h.poidsMois?.length === 12
  const poidsU = Object.fromEntries(UNIVERS.map((u) => {
    const r = h.caMensuelUnivers?.[u]
    return [u, !propre && r?.length === 12 && somme(r) > 0 ? poidsMensuels(r) : poids]
  })) as Record<Univers, number[]>
  const ouvertureU = Object.fromEntries(UNIVERS.map((u) => [u, somme(poidsU[u].map((w, i) => w * travaux.activite[i]))])) as Record<Univers, number>
  const enMois = (u: Univers, i: number) => (ouverture > 0 && ouvertureU[u] > 0 ? base[u] * poidsU[u][i] * travaux.activite[i] / ouvertureU[u] : 0)
  const ajustements = (h.ajustementsCA ?? []).filter((a) => moisValide(a.de) && moisValide(a.a) && UNIVERS.includes(a.univers))
  const ajout = Object.fromEntries(UNIVERS.map((u) => [u, poids.map((_, i) => {
    const tf = somme(tempsForts.filter((t) => t.univers === u && t.mois === i + 1).map((t) => t.ca || 0))
    const adj = somme(ajustements.filter((a) => a.univers === u && a.de <= i + 1 && i + 1 <= a.a).map((a) => (Number.isFinite(a.montant) ? a.montant! : (a.taux ?? 0) * enMois(u, i))))
    return { tf, adj }
  })])) as Record<Univers, { tf: number; adj: number }[]>

  const detailCA = Object.fromEntries(UNIVERS.map((u) => {
    const depart = atterriU(u) * facteur[u]
    const fl = flux[u as 'cave' | 'bar']
    const tf = somme(ajout[u].map((x) => x.tf)), adj = somme(ajout[u].map((x) => x.adj))
    const d: DetailCAUnivers = {
      atterri: atterriU(u), horsTempsForts: horsTempsForts[u], base: depart, rythme: sortie[u as 'cave' | 'bar']?.statut === 'applique',
      ...(fl?.parTickets ? { tickets: fl.evolution, panier: fl.evolutionPanier } : {}),
      evolution: fl?.parTickets || !(depart * ouverture > 0) ? 0 : base[u] / (depart * ouverture) - 1,
      ouverture, tempsForts: tf, ajustements: adj, ca: base[u] + tf + adj,
    }
    return [u, d]
  })) as Record<Univers, DetailCAUnivers>

  const tauxDe = (f: { margeCible: number; demarque?: number }) => f.margeCible - (f.demarque ?? 0)
  const margeAvant = somme(h.familles.map((f, i) => objectifs[i] * tauxDe(f)))
  const tauxAvant = ratio(margeAvant, somme(objectifs))
  const familles: ResultatFamille[] = h.familles.map((f, i) => ({ ...f, atterrissage: atterries[i], objectif: objectifs[i], margeObjectif: 0 }))
  for (const u of UNIVERS) {
    const total = somme(ajout[u].map((x) => x.tf + x.adj))
    if (!total) continue
    const dans = dansU(u)
    // Réparti entre les familles de l'univers comme leur CA ; un univers sans famille en reçoit une
    if (!dans.length) {
      familles.push({ univers: u, famille: 'Temps forts', caRealise: 0, margeRealisee: tauxAvant, evolution: 0, margeCible: tauxAvant, atterrissage: 0, objectif: total, margeObjectif: 0 })
      continue
    }
    dans.forEach((i) => { familles[i].objectif += total * (base[u] > 0 ? objectifs[i] / base[u] : 1 / dans.length) })
  }
  for (const f of familles) f.margeObjectif = f.objectif * tauxDe(f)

  const atterrissage = somme(familles.map((f) => f.atterrissage))
  const ca = somme(familles.map((f) => f.objectif))
  const marge = somme(familles.map((f) => f.margeObjectif))
  const tauxMarge = ratio(marge, ca)
  const tauxU = Object.fromEntries(UNIVERS.map((u) => {
    const l = familles.filter((f) => f.univers === u)
    return [u, ratio(somme(l.map((f) => f.margeObjectif)), somme(l.map((f) => f.objectif)))]
  })) as Record<Univers, number>
  const amortissements = h.amortissements + travaux.dotation
  const g = h.personnel
  // Avec l'équipe du magasin, le personnel se calcule personne par personne
  const equipe = h.equipe?.length ? masseSalariale(h.equipe, p.charges, h.annee, h.hausseSalaires ?? 0) : null

  // Démarque des consignes (29/10/2026) : vides jamais remboursés, en part des consignes versées avec les achats de
  // chaque univers ; charge externe répartie comme le CA, le reste des consignes ne touche pas le compte de résultat
  const cons = p.tresorerie?.consignes
  const consignesAn = cons?.demarque ? somme(UNIVERS.map((u) => somme(familles.filter((f) => f.univers === u).map((f) => f.objectif - f.margeObjectif)) * (cons.achats[u] ?? 0))) * cons.demarque : 0

  const mois: Mois[] = poids.map((_, i) => {
    const univers = Object.fromEntries(UNIVERS.map((u) => {
      const caU = enMois(u, i) + ajout[u][i].tf + ajout[u][i].adj
      return [u, { ca: caU, achats: caU * (1 - tauxU[u]), achatsTempsForts: ajout[u][i].tf * (1 - tauxU[u]) }]
    })) as NonNullable<Mois['univers']>
    const caMois = somme(UNIVERS.map((u) => univers[u].ca))
    const margeMois = somme(UNIVERS.map((u) => univers[u].ca * tauxU[u]))
    const duMois = tempsForts.filter((t) => t.mois === i + 1)
    const autresChargesTempsForts = somme(duMois.map((t) => Math.max(0, t.autresCharges || 0)))
    const demarqueConsignes = ca > 0 ? consignesAn * caMois / ca : 0
    let externes = caMois * (p.tauxRedevance + p.tauxPublicite) + autresChargesTempsForts + demarqueConsignes
    let impots = 0
    for (const l of h.frais) {
      const montant = (l.annuel ?? 0) / 12 + caMois * (l.tauxCA ?? 0)
      if (l.rubrique === 'impots_taxes') impots += montant
      else externes += montant
    }
    const personnel = (equipe ? equipe.parMois[i].cout : (g.salairesMensuels[i] ?? 0) + g.remunerationGerance * (1 + g.tauxCotisationsGerance))
    const ebe = margeMois - externes - impots - personnel
    const resultatExploitation = ebe - amortissements / 12
    const heures = equipe ? equipe.parMois[i].heures : g.heuresMensuelles[i] ?? 0
    return {
      ca: caMois, achats: caMois - margeMois, marge: margeMois, chargesExternes: externes, impotsTaxes: impots, personnel, ebe,
      resultatExploitation, resultatAvantImpot: resultatExploitation - h.interets / 12, productivite: heures > 0 ? caMois / heures : null,
      univers, autresChargesTempsForts, demarqueConsignes,
    }
  })

  const total = (k: keyof Omit<Mois, 'productivite' | 'univers' | 'autresChargesTempsForts' | 'demarqueConsignes'>) => somme(mois.map((m) => m[k]))
  const personnel = total('personnel')
  const ebe = total('ebe')
  const resultatAvantImpot = total('resultatAvantImpot')
  const impot = impotSocietes(resultatAvantImpot, h.deficitReportable, p.impot)
  const resultatNet = resultatAvantImpot - impot
  const capaciteAutofinancement = resultatNet + amortissements

  return {
    familles, partRealisee, atterrissage, ca, marge, tauxMarge, poids, activite: travaux.activite, amortissements, mois,
    redevance: ca * p.tauxRedevance, publicite: ca * p.tauxPublicite,
    chargesExternes: total('chargesExternes'), impotsTaxes: total('impotsTaxes'), personnel, ebe,
    resultatExploitation: total('resultatExploitation'), resultatAvantImpot, impot, resultatNet, capaciteAutofinancement,
    tresorerieDegagee: capaciteAutofinancement - h.remboursementCapital,
    ratios: { personnelSurMarge: ratio(personnel, marge), personnelSurCA: ratio(personnel, ca), ebeSurCA: ratio(ebe, ca) },
    flux,
    sortie,
    detailCA,
    tempsForts: {
      retire: somme(UNIVERS.map((u) => passes(u))),
      ajoute: somme(tempsForts.map((t) => t.ca || 0)),
      charges: somme(tempsForts.map((t) => Math.max(0, t.autresCharges || 0))),
      ajustements: somme(UNIVERS.map((u) => somme(ajout[u].map((x) => x.adj)))),
    },
    paiementsTempsForts: tempsForts.map((t) => ({ mois: moisValide(t.moisAchats) ? t.moisAchats - 1 : t.mois - 1, montant: (t.ca || 0) * (1 - tauxU[t.univers]), vente: t.mois - 1, univers: t.univers })),
  }
}

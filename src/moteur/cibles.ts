import { universLibelle, type Famille, type Hypotheses, type Travaux, type Univers } from './types'

// Hypothèses du budget par niveaux : le siège fixe des cibles pour le réseau, éventuellement pour un groupe de magasins,
// et le magasin peut s'en écarter. Chaque valeur vient du niveau le plus proche du magasin qui la renseigne :
// magasin, puis groupe, puis réseau, puis la base du magasin (son propre réalisé). Fonction pure, testée.

export type Niveau = 'reseau' | 'groupe' | 'magasin'
export const niveauLibelle: Record<Niveau | 'base', string> = { reseau: 'Réseau', groupe: 'Groupe', magasin: 'Magasin', base: 'Réalisé' }

// Clé d'une famille : son univers et son nom (une même famille peut exister en Cave et au Bar)
export const cleFamille = (f: Pick<Famille, 'univers' | 'famille'>) => `${f.univers}/${f.famille}`

export interface Cibles {
  evolutionUnivers?: Partial<Record<Univers, number>> // évolution du CA de toutes les familles d'un univers
  evolutionFamille?: Record<string, number>           // par cleFamille, prime sur l'univers au même niveau
  margeFamille?: Record<string, number>               // marge visée, par cleFamille
  demarqueFamille?: Record<string, number>            // démarque en part du CA, par cleFamille
  hausseSalaires?: number                             // appliquée aux salaires de l'année en cours
  inflationFrais?: number                             // appliquée aux frais annuels (pas à ceux en % du CA)
  evolutionFlux?: Partial<Record<'cave' | 'bar', number>>  // évolution du nombre de tickets
  evolutionPanier?: Partial<Record<'cave' | 'bar', number>> // évolution du panier moyen TTC
  mixFamille?: Record<string, number>                  // part visée de la famille dans le CA de son univers (Cave, Bar)
  poidsMois?: number[]                                // magasin seulement : sa saisonnalité
  travaux?: Travaux                                   // magasin seulement : ses travaux de l'année
  tresorerieDepart?: number                           // magasin seulement : trésorerie au 1er janvier
}

export interface Provenance { cle: string; libelle: string; valeur: number; source: Niveau | 'base' }

export interface NiveauCibles { niveau: Niveau; cibles: Cibles | null | undefined }

const defini = (v: number | undefined | null): v is number => typeof v === 'number' && Number.isFinite(v)

// Première valeur renseignée, du magasin vers le réseau
function resoudre(niveaux: NiveauCibles[], lire: (c: Cibles) => number | undefined): { valeur: number; source: Niveau } | null {
  for (const n of [...niveaux].reverse()) {
    const v = n.cibles ? lire(n.cibles) : undefined
    if (defini(v)) return { valeur: v, source: n.niveau }
  }
  return null
}

// niveaux : du plus large au plus proche du magasin (réseau, groupe, magasin)
export function appliquerCibles(base: Hypotheses, niveaux: NiveauCibles[]): { hypotheses: Hypotheses; provenance: Provenance[] } {
  const provenance: Provenance[] = []

  // Univers pilotés par les tickets : le mix des familles remplace leur évolution
  const pilote = (u: Univers) => (u === 'cave' || u === 'bar') && (base.flux?.[u]?.realise ?? 0) > 0
  const caUnivers = (u: Univers) => base.familles.filter((f) => f.univers === u).reduce((a, f) => a + f.caRealise, 0)
  const familles = base.familles.map((f) => {
    const cle = cleFamille(f)
    if (pilote(f.univers)) {
      const marge = resoudre(niveaux, (c) => c.margeFamille?.[cle])
      const dem = resoudre(niveaux, (c) => c.demarqueFamille?.[cle])
      const part = resoudre(niveaux, (c) => c.mixFamille?.[cle])
      const total = caUnivers(f.univers)
      const nom = `${f.famille} (${universLibelle[f.univers]})`
      provenance.push({ cle: `mix/${cle}`, libelle: `Part de ${nom}`, valeur: part?.valeur ?? (total > 0 ? f.caRealise / total : 0), source: part?.source ?? 'base' })
      provenance.push({ cle: `marge/${cle}`, libelle: `Marge visée ${nom}`, valeur: marge?.valeur ?? f.margeRealisee, source: marge?.source ?? 'base' })
      provenance.push({ cle: `demarque/${cle}`, libelle: `Démarque ${nom}`, valeur: dem?.valeur ?? 0, source: dem?.source ?? 'base' })
      const { part: _, ...sansPart } = f
      return { ...sansPart, evolution: 0, margeCible: marge?.valeur ?? f.margeRealisee, demarque: dem?.valeur ?? 0, ...(part ? { part: part.valeur } : {}) }
    }
    const evo = resoudre(niveaux, (c) => c.evolutionFamille?.[cle] ?? c.evolutionUnivers?.[f.univers])
    const marge = resoudre(niveaux, (c) => c.margeFamille?.[cle])
    const dem = resoudre(niveaux, (c) => c.demarqueFamille?.[cle])
    const evolution = evo?.valeur ?? 0
    const margeCible = marge?.valeur ?? f.margeRealisee
    const demarque = dem?.valeur ?? 0
    const nom = `${f.famille} (${universLibelle[f.univers]})`
    provenance.push({ cle: `evolution/${cle}`, libelle: `Évolution du CA ${nom}`, valeur: evolution, source: evo?.source ?? 'base' })
    provenance.push({ cle: `marge/${cle}`, libelle: `Marge visée ${nom}`, valeur: margeCible, source: marge?.source ?? 'base' })
    provenance.push({ cle: `demarque/${cle}`, libelle: `Démarque ${nom}`, valeur: demarque, source: dem?.source ?? 'base' })
    return { ...f, evolution, margeCible, demarque }
  })

  const hausse = resoudre(niveaux, (c) => c.hausseSalaires)
  const tauxHausse = hausse?.valeur ?? 0
  provenance.push({ cle: 'hausseSalaires', libelle: 'Hausse des salaires', valeur: tauxHausse, source: hausse?.source ?? 'base' })

  const inflation = resoudre(niveaux, (c) => c.inflationFrais)
  const tauxInflation = inflation?.valeur ?? 0
  provenance.push({ cle: 'inflationFrais', libelle: 'Inflation des frais', valeur: tauxInflation, source: inflation?.source ?? 'base' })

  let flux = base.flux
  if (base.flux) {
    flux = { ...base.flux }
    for (const u of ['cave', 'bar'] as const) {
      const f = base.flux[u]
      if (!f) continue
      // Comme pour les familles, la base est le réalisé : sans cible, ni les tickets ni le panier n'évoluent
      const evo = resoudre(niveaux, (c) => c.evolutionFlux?.[u])
      const pan = resoudre(niveaux, (c) => c.evolutionPanier?.[u])
      const evolution = evo?.valeur ?? 0
      const evolutionPanier = pan?.valeur ?? 0
      provenance.push({ cle: `flux/${u}`, libelle: `Évolution du nombre de tickets ${universLibelle[u]}`, valeur: evolution, source: evo?.source ?? 'base' })
      provenance.push({ cle: `panier/${u}`, libelle: `Évolution du panier moyen ${universLibelle[u]}`, valeur: evolutionPanier, source: pan?.source ?? 'base' })
      flux[u] = { ...f, evolution, evolutionPanier }
    }
  }

  // Saisonnalité et travaux : propres au magasin, repris tels quels du niveau le plus proche qui les renseigne
  const propre = <K extends 'poidsMois' | 'travaux'>(k: K) => [...niveaux].reverse().find((n) => n.cibles?.[k])
  const poids = propre('poidsMois')
  const travaux = propre('travaux')
  if (poids) provenance.push({ cle: 'poidsMois', libelle: 'Saisonnalité du magasin', valeur: 1, source: poids.niveau })
  if (travaux) provenance.push({ cle: 'travaux', libelle: 'Travaux', valeur: 1, source: travaux.niveau })

  return {
    hypotheses: {
      ...base,
      familles,
      flux,
      caParTickets: true,
      ...(poids ? { poidsMois: poids.cibles!.poidsMois } : {}),
      ...(travaux ? { travaux: travaux.cibles!.travaux } : {}),
      // Avec l'équipe, la hausse s'applique au brut de chacun (la réduction générale en dépend) ; sinon aux salaires chargés
      ...(base.equipe?.length ? { hausseSalaires: tauxHausse } : {}),
      personnel: base.equipe?.length ? base.personnel : { ...base.personnel, salairesMensuels: base.personnel.salairesMensuels.map((s) => s * (1 + tauxHausse)) },
      frais: base.frais.map((l) => (defini(l.annuel) ? { ...l, annuel: l.annuel * (1 + tauxInflation) } : l)),
    },
    provenance,
  }
}

// Valeurs que le magasin a choisies à l'écart de ce que le siège propose (réseau ou groupe)
export function ecarts(provenance: Provenance[]): Provenance[] {
  return provenance.filter((p) => p.source === 'magasin')
}

// Lecture et écriture d'une cible par sa clé (celle de la provenance, plus « univers/<univers> »).
// undefined efface la valeur : le niveau reprend celle du niveau au-dessus.
export function lireCible(c: Cibles | null | undefined, cle: string): number | undefined {
  if (!c) return undefined
  const [type, ...reste] = cle.split('/')
  const k = reste.join('/')
  if (type === 'evolution') return c.evolutionFamille?.[k]
  if (type === 'marge') return c.margeFamille?.[k]
  if (type === 'demarque') return c.demarqueFamille?.[k]
  if (type === 'univers') return c.evolutionUnivers?.[k as Univers]
  if (type === 'flux') return c.evolutionFlux?.[k as 'cave' | 'bar']
  if (type === 'panier') return c.evolutionPanier?.[k as 'cave' | 'bar']
  if (type === 'mix') return c.mixFamille?.[k]
  if (type === 'hausseSalaires') return c.hausseSalaires
  if (type === 'inflationFrais') return c.inflationFrais
  return undefined
}

export function ecrireCible(c: Cibles, cle: string, v: number | undefined): Cibles {
  const [type, ...reste] = cle.split('/')
  const k = reste.join('/')
  const dans = <T extends object>(o: T | undefined): T => {
    const copie = { ...(o ?? {}) } as Record<string, number>
    if (defini(v)) copie[k] = v
    else delete copie[k]
    return copie as T
  }
  const r: Cibles = { ...c }
  if (type === 'evolution') r.evolutionFamille = dans(c.evolutionFamille)
  else if (type === 'marge') r.margeFamille = dans(c.margeFamille)
  else if (type === 'demarque') r.demarqueFamille = dans(c.demarqueFamille)
  else if (type === 'univers') r.evolutionUnivers = dans(c.evolutionUnivers)
  else if (type === 'flux') r.evolutionFlux = dans(c.evolutionFlux)
  else if (type === 'panier') r.evolutionPanier = dans(c.evolutionPanier)
  else if (type === 'mix') r.mixFamille = dans(c.mixFamille)
  else if (type === 'hausseSalaires') { if (defini(v)) r.hausseSalaires = v; else delete r.hausseSalaires }
  else if (type === 'inflationFrais') { if (defini(v)) r.inflationFrais = v; else delete r.inflationFrais }
  return r
}

// Valeur héritée d'un niveau : la première renseignée au-dessus de lui
// (l'évolution d'une famille reprend celle de son univers, comme dans appliquerCibles)
export function valeurHeritee(niveauxAuDessus: NiveauCibles[], cle: string): { valeur: number; source: Niveau } | null {
  const [type, univers] = cle.split('/')
  return resoudre(niveauxAuDessus, (c) => lireCible(c, cle) ?? (type === 'evolution' ? lireCible(c, `univers/${univers}`) : undefined))
}

// Ajustements d'un magasin repris sur un autre : tout sauf les travaux et la trésorerie de départ, propres à chaque
// magasin (ceux du magasin visé restent)
export function ajustementsCopies(source: Cibles, cible: Cibles): Cibles {
  const { travaux: _, tresorerieDepart: __, ...copie } = structuredClone(source)
  return {
    ...copie,
    ...(cible.travaux ? { travaux: cible.travaux } : {}),
    ...(cible.tresorerieDepart !== undefined ? { tresorerieDepart: cible.tresorerieDepart } : {}),
  }
}

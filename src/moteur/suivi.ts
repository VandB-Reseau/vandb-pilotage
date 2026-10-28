import { masseSalariale, type ParametresCharges, type Personne } from './equipe'
import type { LigneReel, TicketsReel } from './reel'
import type { Budget, LigneFrais } from './types'

// Réel face au budget, mois par mois, et indicateurs de chaque magasin du réseau à date.
// La marge réelle ne compte que là où la caisse la donne : un mois dont une famille n'a pas de marge n'a pas d'écart de marge,
// et le taux de marge se calcule sur le CA des familles dont la marge est connue.

export interface MoisReel {
  caHT: number; margeHT: number; caAvecMarge: number; caTTC: number; tickets: number
  univers?: Record<UniversTickets, { caTTC: number; tickets: number }> // Cave et Bar séparés (lot 22)
}
export type UniversTickets = 'cave' | 'bar'
export const UNIVERS_PANIER: UniversTickets[] = ['cave', 'bar']

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const ratio = (a: number, b: number) => (b ? a / b : 0)
const vide = (): MoisReel => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0, univers: { cave: { caTTC: 0, tickets: 0 }, bar: { caTTC: 0, tickets: 0 } } })

// Lignes de la caisse d'un magasin ramenées à 12 mois
export function moisDuReel(lignes: LigneReel[], tickets: TicketsReel[]): MoisReel[] {
  const mois = Array.from({ length: 12 }, vide)
  for (const l of lignes) {
    const m = mois[l.mois - 1]
    if (!m) continue
    m.caHT += l.caHT
    m.caTTC += l.caTTC ?? 0
    if (l.univers === 'cave' || l.univers === 'bar') m.univers![l.univers].caTTC += l.caTTC ?? 0
    if (l.margeHT !== null) { m.margeHT += l.margeHT; m.caAvecMarge += l.caHT }
  }
  for (const t of tickets) {
    const m = mois[t.mois - 1]
    if (!m) continue
    m.tickets += t.tickets
    if (t.univers === 'cave' || t.univers === 'bar') m.univers![t.univers].tickets += t.tickets
  }
  return mois
}

// Dernier mois avec du CA (0 : aucun)
export const dernierMois = (mois: MoisReel[]) => mois.reduce((d, m, i) => (m.caHT > 0 ? i + 1 : d), 0)
const margeComplete = (m: MoisReel) => m.caHT > 0 && Math.abs(m.caAvecMarge - m.caHT) < 0.005

export interface LigneSuivi {
  caReel: number | null      // null après le dernier mois réalisé
  caBudget: number
  ecartCA: number | null
  margeReel: number | null   // null si le mois n'est pas réalisé ou si une famille n'a pas de marge
  margeBudget: number
  ecartMarge: number | null
}
export interface Suivi {
  moisRealises: number
  mois: LigneSuivi[]
  cumul: {
    caReel: number; caBudget: number; ecartCA: number; ecartCAPart: number | null
    tauxMargeReel: number | null; tauxMargeBudget: number
    margeReel: number | null; margeBudget: number; ecartMarge: number | null // sur les mois dont la marge est complète
  }
}

export function suiviBudget(mois: MoisReel[], budget: Budget): Suivi {
  const n = dernierMois(mois)
  const lignes: LigneSuivi[] = budget.mois.map((b, i) => {
    const r = mois[i]
    const fait = i < n
    const marge = fait && margeComplete(r) ? r.margeHT : null
    return {
      caReel: fait ? r.caHT : null, caBudget: b.ca, ecartCA: fait ? r.caHT - b.ca : null,
      margeReel: marge, margeBudget: b.marge, ecartMarge: marge === null ? null : marge - b.marge,
    }
  })
  const faits = lignes.slice(0, n)
  const caReel = somme(faits.map((l) => l.caReel ?? 0))
  const caBudget = somme(faits.map((l) => l.caBudget))
  const avecMarge = faits.filter((l) => l.margeReel !== null)
  const caAvecMarge = somme(mois.slice(0, n).map((m) => m.caAvecMarge))
  return {
    moisRealises: n,
    mois: lignes,
    cumul: {
      caReel, caBudget, ecartCA: caReel - caBudget, ecartCAPart: caBudget ? caReel / caBudget - 1 : null,
      tauxMargeReel: caAvecMarge > 0 ? somme(mois.slice(0, n).map((m) => m.margeHT)) / caAvecMarge : null,
      tauxMargeBudget: budget.tauxMarge,
      margeReel: avecMarge.length ? somme(avecMarge.map((l) => l.margeReel!)) : null,
      margeBudget: somme(avecMarge.map((l) => l.margeBudget)),
      ecartMarge: avecMarge.length ? somme(avecMarge.map((l) => l.ecartMarge!)) : null,
    },
  }
}

// ── Réseau : chaque magasin à la fin de son dernier mois réalisé
export interface EntreeReseau {
  magasin: string
  n: MoisReel[]                 // année en cours
  n1: MoisReel[]                // année précédente (CA à zéro si inconnue)
  budget: Budget | null         // budget de l'année en cours, s'il existe
  equipe: Personne[] | undefined
  frais: LigneFrais[] | undefined
}
export interface ParametresReseauSuivi { tauxRedevance: number; tauxPublicite: number; charges: ParametresCharges; annee: number }

export interface LigneReseau {
  magasin: string
  moisRealises: number
  ca: number
  evolution: number | null       // sur les mêmes mois de l'an dernier
  ecartBudget: number | null     // CA réel / CA budgété des mêmes mois − 1
  tauxMarge: number | null
  // Cave et Bar séparés (lot 22) : panier TTC et évolution des tickets sur les mêmes mois de l'an dernier
  panierCave: number | null
  panierBar: number | null
  ticketsCave: number | null
  ticketsBar: number | null
  personnelSurMarge: number | null // masse salariale de l'équipe sur la marge des mêmes mois
  caParHeure: number | null        // CA HT par heure travaillée de l'équipe, mêmes mois (lot 28)
  ebeSurCA: number | null          // EBE estimé à date : marge − redevance, publicité, frais et équipe des mêmes mois
  loyerSurCA: number | null        // ligne « Locations immobilières » des frais sur le CA des mêmes mois
  sommes: Sommes
}
// Montants derrière les pourcentages, pour totaliser le réseau ; null : non calculable pour ce magasin
interface Sommes {
  ca: number; caN1: number | null; caBudget: number | null
  marge: number; caAvecMarge: number; margeEstimee: number | null
  caTTC: number; tickets: number; personnel: number | null; heures: number | null; ebe: number | null; loyer: number | null
  univers: Record<UniversTickets, SommesUnivers>
}
// caTTC et ticketsPanier : mois où CA TTC et tickets sont connus ; tickets et ticketsN1 : tous les mois réalisés
interface SommesUnivers { caTTC: number; ticketsPanier: number; tickets: number; ticketsN1: number }

const pourcentages = (s: Sommes) => ({
  evolution: s.caN1 ? s.ca / s.caN1 - 1 : null,
  ecartBudget: s.caBudget ? s.ca / s.caBudget - 1 : null,
  tauxMarge: s.caAvecMarge > 0 ? s.marge / s.caAvecMarge : null,
  panierCave: s.univers.cave.ticketsPanier > 0 ? s.univers.cave.caTTC / s.univers.cave.ticketsPanier : null,
  panierBar: s.univers.bar.ticketsPanier > 0 ? s.univers.bar.caTTC / s.univers.bar.ticketsPanier : null,
  ticketsCave: s.univers.cave.ticketsN1 > 0 && s.univers.cave.tickets > 0 ? s.univers.cave.tickets / s.univers.cave.ticketsN1 - 1 : null,
  ticketsBar: s.univers.bar.ticketsN1 > 0 && s.univers.bar.tickets > 0 ? s.univers.bar.tickets / s.univers.bar.ticketsN1 - 1 : null,
  personnelSurMarge: s.personnel !== null && s.margeEstimee ? s.personnel / s.margeEstimee : null,
  caParHeure: s.heures ? s.ca / s.heures : null,
  ebeSurCA: s.ebe !== null && s.ca ? s.ebe / s.ca : null,
  loyerSurCA: s.loyer !== null && s.ca ? s.loyer / s.ca : null,
})

function sommesUnivers(n: MoisReel[], n1: MoisReel[], u: UniversTickets): SommesUnivers {
  const de = (x: MoisReel) => x.univers?.[u] ?? { caTTC: 0, tickets: 0 }
  const avec = n.map(de).filter((x) => x.tickets > 0 && x.caTTC > 0)
  return {
    caTTC: somme(avec.map((x) => x.caTTC)), ticketsPanier: somme(avec.map((x) => x.tickets)),
    tickets: somme(n.map((x) => de(x).tickets)), ticketsN1: somme(n1.map((x) => de(x).tickets)),
  }
}

export function ligneReseau(e: EntreeReseau, p: ParametresReseauSuivi): LigneReseau {
  const m = dernierMois(e.n)
  const mois = e.n.slice(0, m)
  const ca = somme(mois.map((x) => x.caHT))
  const caN1 = somme(e.n1.slice(0, m).map((x) => x.caHT))
  const caBudget = e.budget ? somme(e.budget.mois.slice(0, m).map((x) => x.ca)) : 0
  const marge = somme(mois.map((x) => x.margeHT)), caAvecMarge = somme(mois.map((x) => x.caAvecMarge))
  // Marge de tout le CA, au taux des familles dont la marge est connue
  const margeEstimee = caAvecMarge > 0 ? ca * marge / caAvecMarge : null
  // Panier moyen : seulement les mois où CA TTC et tickets sont connus
  const avecPanier = mois.filter((x) => x.tickets > 0 && x.caTTC > 0)
  const equipe = m && e.equipe?.length ? masseSalariale(e.equipe, p.charges, p.annee).parMois.slice(0, m) : null
  const personnel = equipe ? somme(equipe.map((x) => x.cout)) : null
  const heures = equipe ? somme(equipe.map((x) => x.heures)) || null : null
  const aDate = (l: LigneFrais) => (l.annuel ?? 0) * m / 12 + ca * (l.tauxCA ?? 0)
  const frais = m && e.frais?.length ? somme(e.frais.map(aDate)) : null
  const loyers = e.frais?.filter((l) => l.code === 'loyer') ?? []
  const sommes: Sommes = {
    ca, caN1: m && caN1 > 0 ? caN1 : null, caBudget: m && caBudget > 0 ? caBudget : null,
    marge, caAvecMarge, margeEstimee,
    caTTC: somme(avecPanier.map((x) => x.caTTC)), tickets: somme(avecPanier.map((x) => x.tickets)),
    personnel, heures,
    ebe: margeEstimee !== null && personnel !== null && frais !== null ? margeEstimee - ca * (p.tauxRedevance + p.tauxPublicite) - frais - personnel : null,
    loyer: m && loyers.length ? somme(loyers.map(aDate)) : null,
    univers: { cave: sommesUnivers(mois, e.n1.slice(0, m), 'cave'), bar: sommesUnivers(mois, e.n1.slice(0, m), 'bar') },
  }
  return { magasin: e.magasin, moisRealises: m, ca, ...pourcentages(sommes), sommes }
}

// Repère du réseau : totaux des magasins, pas la moyenne des pourcentages (un gros magasin pèse plus).
// Chaque pourcentage ne totalise que les magasins où il se calcule.
export function totalReseau(lignes: LigneReseau[]): Omit<LigneReseau, 'magasin' | 'moisRealises'> & { magasins: number } {
  const l = lignes.filter((x) => x.moisRealises > 0).map((x) => x.sommes)
  const t = (f: (s: Sommes) => number) => somme(l.map(f))
  const avec = <K extends keyof Sommes>(k: K, f: (s: Sommes) => number) => somme(l.filter((s) => s[k] !== null).map(f))
  const sommes: Sommes = {
    ca: t((s) => s.ca),
    caN1: avec('caN1', (s) => s.caN1!) || null, caBudget: avec('caBudget', (s) => s.caBudget!) || null,
    marge: t((s) => s.marge), caAvecMarge: t((s) => s.caAvecMarge),
    margeEstimee: null, caTTC: t((s) => s.caTTC), tickets: t((s) => s.tickets), personnel: null, heures: null, ebe: null, loyer: null,
    univers: Object.fromEntries(UNIVERS_PANIER.map((u) => {
      const v = l.map((s) => s.univers[u])
      // Évolution des tickets : seulement les magasins qui ont des tickets l'an dernier
      const avecN1 = v.filter((x) => x.ticketsN1 > 0)
      return [u, { caTTC: somme(v.map((x) => x.caTTC)), ticketsPanier: somme(v.map((x) => x.ticketsPanier)), tickets: somme(avecN1.map((x) => x.tickets)), ticketsN1: somme(avecN1.map((x) => x.ticketsN1)) }]
    })) as Record<UniversTickets, SommesUnivers>,
  }
  const p = pourcentages(sommes)
  const ratioSur = (k: 'personnel' | 'ebe' | 'loyer', den: (s: Sommes) => number | null) => {
    const v = l.filter((s) => s[k] !== null && den(s))
    return v.length ? ratio(somme(v.map((s) => s[k]!)), somme(v.map((s) => den(s)!))) : null
  }
  return {
    magasins: l.length, ca: sommes.ca, sommes,
    // Évolution et écart au budget : rapportés au CA des seuls magasins qui ont un an dernier ou un budget
    evolution: sommes.caN1 ? avec('caN1', (s) => s.ca) / sommes.caN1 - 1 : null,
    ecartBudget: sommes.caBudget ? avec('caBudget', (s) => s.ca) / sommes.caBudget - 1 : null,
    tauxMarge: p.tauxMarge, panierCave: p.panierCave, panierBar: p.panierBar, ticketsCave: p.ticketsCave, ticketsBar: p.ticketsBar,
    personnelSurMarge: ratioSur('personnel', (s) => s.margeEstimee),
    // CA par heure : CA des seuls magasins dont l'équipe est connue, sur leurs heures
    caParHeure: (() => { const v = l.filter((s) => s.heures); return v.length ? somme(v.map((s) => s.ca)) / somme(v.map((s) => s.heures!)) : null })(),
    ebeSurCA: ratioSur('ebe', (s) => s.ca),
    loyerSurCA: ratioSur('loyer', (s) => s.ca),
  }
}

import type { BaseDepuisReel, MethodeAtterrissage } from './atterrissage'
import { UNIVERS, universLibelle, type Budget, type Univers } from './types'

// « D'où vient ce chiffre ? » (lot 25) : le calcul du CA, de la marge et de l'EBE du budget, étape par étape, avec les
// chiffres du magasin. Chaque étape donne son effet et le résultat cumulé après elle : une évolution (taux), une part du
// montant précédent (part, la marge visée) ou un montant ajouté ou retiré.
export interface Etape { libelle: string; taux?: number; part?: number; diviseur?: number; montant?: number; resultat: number }
export interface GroupeCalcul { titre: string; etapes: Etape[] }
export interface Explication { groupes: GroupeCalcul[]; total: number }

const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const ratio = (a: number, b: number) => (b ? a / b : 0)
const EPS = 0.5

export function expliquerCA(b: Budget, annee: number): Explication {
  const groupes: GroupeCalcul[] = []
  for (const u of UNIVERS) {
    const d = b.detailCA?.[u]
    if (!d || (d.atterri <= 0 && Math.abs(d.ca) < EPS)) continue
    const etapes: Etape[] = [{ libelle: `CA ${annee - 1} attendu`, resultat: d.atterri }]
    let r = d.atterri
    if (d.atterri - d.horsTempsForts > EPS) { r = d.horsTempsForts; etapes.push({ libelle: `Temps forts ${annee - 1} retirés`, montant: -(d.atterri - d.horsTempsForts), resultat: r }) }
    if (d.rythme) { etapes.push({ libelle: 'Rythme des derniers mois', taux: ratio(d.base, r) - 1, resultat: d.base }); r = d.base }
    const fois = (libelle: string, t: number | undefined) => {
      if (!t || Math.abs(t) < 1e-9) return
      r *= 1 + t
      etapes.push({ libelle, taux: t, resultat: r })
    }
    fois('Évolution des tickets', d.tickets)
    fois('Évolution du panier moyen', d.panier)
    fois('Évolution des familles', d.evolution)
    fois('Travaux : part de l’année ouverte', d.ouverture - 1)
    if (Math.abs(d.tempsForts) >= EPS) { r += d.tempsForts; etapes.push({ libelle: `Temps forts ${annee}`, montant: d.tempsForts, resultat: r }) }
    if (Math.abs(d.ajustements) >= EPS) { r += d.ajustements; etapes.push({ libelle: 'Ajustements datés', montant: d.ajustements, resultat: r }) }
    groupes.push({ titre: universLibelle[u], etapes })
  }
  return { groupes, total: b.ca }
}

export function expliquerMarge(b: Budget): Explication {
  const groupes: GroupeCalcul[] = []
  for (const u of UNIVERS) {
    const l = b.familles.filter((f) => f.univers === (u as Univers))
    const ca = somme(l.map((f) => f.objectif))
    if (Math.abs(ca) < EPS) continue
    const visee = ratio(somme(l.map((f) => f.objectif * f.margeCible)), ca)
    const demarque = ratio(somme(l.map((f) => f.objectif * (f.demarque ?? 0))), ca)
    const etapes: Etape[] = [
      { libelle: 'Chiffre d’affaires HT', resultat: ca },
      { libelle: 'Marge visée des familles', part: visee, resultat: ca * visee },
    ]
    if (demarque) etapes.push({ libelle: 'Démarque', part: demarque, montant: -ca * demarque, resultat: ca * (visee - demarque) })
    groupes.push({ titre: universLibelle[u], etapes })
  }
  return { groupes, total: b.marge }
}

export function expliquerEBE(b: Budget): Explication {
  let r = b.marge
  const etapes: Etape[] = [{ libelle: 'Marge commerciale', resultat: r }]
  const moins = (libelle: string, montant: number) => {
    if (Math.abs(montant) < EPS) return
    r -= montant
    etapes.push({ libelle, montant: -montant, resultat: r })
  }
  moins('Redevance', b.redevance)
  moins('Publicité', b.publicite)
  moins('Autres charges externes', b.chargesExternes - b.redevance - b.publicite)
  moins('Impôts et taxes', b.impotsTaxes)
  moins('Personnel', b.personnel)
  return { groupes: [{ titre: 'EBE', etapes }], total: b.ebe }
}

// Atterrissage de l'année en cours (lot 26) : réalisé de chaque univers, puis l'année entière selon sa méthode
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const SOURCE: Record<Exclude<MethodeAtterrissage, 'rythme'>, string> = {
  saisie: 'part saisie', magasin: 'saisonnalité du magasin l’an dernier', reseau: 'saisonnalité médiane du réseau', moyenne: 'moyenne des mois réalisés',
}
export function expliquerAtterrissage(r: BaseDepuisReel): Explication {
  const m = r.moisRealises
  const groupes: GroupeCalcul[] = []
  let total = 0
  for (const u of UNIVERS) {
    const realise = somme(r.base.familles.filter((f) => f.univers === u).map((f) => f.caRealise))
    const part = r.base.partRealisee?.[u]
    if (realise <= 0 || !part) continue
    const annee = realise / part
    total += annee
    const etapes: Etape[] = [{ libelle: `Réalisé de ${MOIS[r.debut - 1]} à ${MOIS[m - 1]}`, resultat: realise }]
    const methode = r.methodes[u]
    const rythme = r.rythmes?.[u]
    if (m < 12) {
      etapes.push(methode === 'rythme' && rythme
        ? { libelle: `${majuscule(MOIS[m])} à décembre, au rythme de ${MOIS[rythme.de - 1]} à ${MOIS[rythme.a - 1]}`, montant: annee - realise, resultat: annee }
        : { libelle: `Part de l’année réalisée (${SOURCE[methode as Exclude<MethodeAtterrissage, 'rythme'>]})`, diviseur: part, resultat: annee })
    }
    groupes.push({ titre: universLibelle[u], etapes })
  }
  return { groupes, total }
}

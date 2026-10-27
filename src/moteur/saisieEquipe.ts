import { nombre } from '../import/caisse'
import type { Categorie, Personne } from './equipe'

// Fiche d'une personne de l'équipe en cours de saisie : champs en texte jusqu'à l'enregistrement
export interface ChampsPersonne {
  id?: number
  poste: string
  categorie: Categorie
  heuresHebdo: string
  brutMensuel: string
  primes: { mois: number; montant: string }[]
  entree: string   // « AAAA-MM » ou vide
  sortie: string
}

const enTexte = (v: number) => String(v).replace('.', ',')

export function champsDepuisPersonne(p: Personne): ChampsPersonne {
  return {
    id: p.id, poste: p.poste, categorie: p.categorie, heuresHebdo: enTexte(p.heuresHebdo), brutMensuel: enTexte(p.brutMensuel),
    primes: p.primes.map((x) => ({ mois: x.mois, montant: enTexte(x.montant) })), entree: p.entree ?? '', sortie: p.sortie ?? '',
  }
}

// Nouveau poste : « Vendeur 3 » s'il y a déjà deux vendeurs, temps plein
export function nouvellePersonne(equipe: Personne[]): ChampsPersonne {
  const n = equipe.filter((p) => /^vendeur/i.test(p.poste)).length + 1
  return { poste: `Vendeur ${n}`, categorie: 'employe', heuresHebdo: '35', brutMensuel: '', primes: [], entree: '', sortie: '' }
}

export function lirePersonne(c: ChampsPersonne): { personne: Personne | null; erreurs: string[] } {
  const erreurs: string[] = []
  const heures = nombre(c.heuresHebdo)
  const brut = nombre(c.brutMensuel)
  if (!c.poste.trim()) erreurs.push('Le poste est à renseigner.')
  if (heures === null || Number.isNaN(heures) || heures < 0 || heures > 70) erreurs.push('Les heures par semaine sont à renseigner (entre 0 et 70).')
  if (brut === null || Number.isNaN(brut) || brut < 0) erreurs.push(c.categorie === 'gerant_tns' ? 'La rémunération mensuelle est à renseigner.' : 'Le salaire brut mensuel est à renseigner.')
  const primes = c.primes.map((x) => ({ mois: x.mois, montant: nombre(x.montant) }))
  // Une prime laissée vide est ignorée
  if (primes.some((x) => x.montant !== null && (Number.isNaN(x.montant) || x.montant < 0))) erreurs.push('Le montant d’une prime est illisible.')
  if (c.entree && c.sortie && c.sortie < c.entree) erreurs.push('Le départ est avant l’arrivée.')
  if (erreurs.length) return { personne: null, erreurs }
  return {
    personne: {
      id: c.id, poste: c.poste.trim(), categorie: c.categorie, heuresHebdo: heures!, brutMensuel: brut!,
      primes: primes.filter((x) => x.montant).map((x) => ({ mois: x.mois, montant: x.montant! })),
      entree: c.entree || null, sortie: c.sortie || null,
    },
    erreurs,
  }
}

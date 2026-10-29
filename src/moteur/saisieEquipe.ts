import { nombre } from '../import/caisse'
import { SEMAINES_PAR_MOIS, type Categorie, type Personne } from './equipe'

// Fiche d'une personne de l'équipe en cours de saisie : champs en texte jusqu'à l'enregistrement
export interface ChampsPersonne {
  id?: number
  poste: string
  categorie: Categorie
  heures: string                       // dans l'unité choisie
  heuresSaisie: 'semaine' | 'mois'
  brutMensuel: string
  primes: { mois: number; montant: string }[]
  entree: string   // « AAAA-MM » ou vide
  sortie: string
  enveloppe: boolean
  tauxHoraire: string              // extras seulement ; vide pour un poste classique
  extra: boolean
}

const enTexte = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',')

export function champsDepuisPersonne(p: Personne): ChampsPersonne {
  return {
    id: p.id, poste: p.poste, categorie: p.categorie, brutMensuel: enTexte(p.brutMensuel),
    heuresSaisie: p.heuresSaisie ?? 'semaine', heures: enTexte(p.heuresSaisie === 'mois' ? p.heuresHebdo * SEMAINES_PAR_MOIS : p.heuresHebdo),
    primes: p.primes.map((x) => ({ mois: x.mois, montant: enTexte(x.montant) })), entree: p.entree ?? '', sortie: p.sortie ?? '',
    enveloppe: !!p.enveloppe, extra: !!p.tauxHoraire, tauxHoraire: p.tauxHoraire ? enTexte(p.tauxHoraire) : '',
  }
}

// Nouveau poste : « Vendeur 3 » s'il y a déjà deux vendeurs, temps plein
export function nouvellePersonne(equipe: Personne[]): ChampsPersonne {
  const n = equipe.filter((p) => /^vendeur/i.test(p.poste)).length + 1
  return { poste: `Vendeur ${n}`, categorie: 'employe', heures: '35', heuresSaisie: 'semaine', brutMensuel: '', primes: [], entree: '', sortie: '', enveloppe: false, extra: false, tauxHoraire: '' }
}

// Primes d'équipe : une enveloppe sans salarié, versée au mois choisi
export function nouvellesPrimesEquipe(): ChampsPersonne {
  return { poste: 'Primes d’équipe', categorie: 'employe', heures: '0', heuresSaisie: 'semaine', brutMensuel: '0', primes: [{ mois: 12, montant: '' }], entree: '', sortie: '', enveloppe: true, extra: false, tauxHoraire: '' }
}

// Extras (29/10/2026) : heures moyennes au mois, taux horaire brut ; le brut du mois en découle
export function nouveauxExtras(): ChampsPersonne {
  return { poste: 'Extras', categorie: 'employe', heures: '', heuresSaisie: 'mois', brutMensuel: '', primes: [], entree: '', sortie: '', enveloppe: false, extra: true, tauxHoraire: '' }
}

export function lirePersonne(c: ChampsPersonne): { personne: Personne | null; erreurs: string[] } {
  const erreurs: string[] = []
  const lues = c.enveloppe ? 0 : nombre(c.heures)
  const heures = lues === null || Number.isNaN(lues) ? lues : c.heuresSaisie === 'mois' ? lues / SEMAINES_PAR_MOIS : lues
  const tauxHoraire = c.extra ? nombre(c.tauxHoraire) : null
  const brut = c.enveloppe ? 0 : c.extra
    ? (tauxHoraire === null || Number.isNaN(tauxHoraire) || heures === null || Number.isNaN(heures) ? tauxHoraire : tauxHoraire * heures * SEMAINES_PAR_MOIS)
    : nombre(c.brutMensuel)
  if (!c.poste.trim()) erreurs.push(c.enveloppe ? 'Le nom des primes est à renseigner.' : 'Le poste est à renseigner.')
  // Les extras additionnent plusieurs personnes : jusqu'à 150 heures par semaine
  const max = c.extra ? 150 : 70
  if (heures === null || Number.isNaN(heures) || heures < 0 || heures > max) {
    erreurs.push(c.heuresSaisie === 'mois' ? `Les heures par mois sont à renseigner (entre 0 et ${Math.round(max * SEMAINES_PAR_MOIS)}).` : `Les heures par semaine sont à renseigner (entre 0 et ${max}).`)
  }
  if (c.extra && (tauxHoraire === null || Number.isNaN(tauxHoraire) || tauxHoraire <= 0 || tauxHoraire >= 1000)) erreurs.push('Le taux horaire brut est à renseigner.')
  else if (brut === null || Number.isNaN(brut) || brut < 0) erreurs.push(c.categorie === 'gerant_tns' ? 'La rémunération mensuelle est à renseigner.' : 'Le salaire brut mensuel est à renseigner.')
  const primes = c.primes.map((x) => ({ mois: x.mois, montant: nombre(x.montant) }))
  // Une prime laissée vide est ignorée
  if (primes.some((x) => x.montant !== null && (Number.isNaN(x.montant) || x.montant < 0))) erreurs.push('Le montant d’une prime est illisible.')
  if (c.enveloppe && !primes.some((x) => x.montant)) erreurs.push('Le montant d’au moins une prime est à renseigner.')
  if (c.entree && c.sortie && c.sortie < c.entree) erreurs.push('Le départ est avant l’arrivée.')
  if (erreurs.length) return { personne: null, erreurs }
  return {
    personne: {
      id: c.id, poste: c.poste.trim(), categorie: c.categorie, heuresHebdo: heures!, brutMensuel: brut!,
      primes: primes.filter((x) => x.montant).map((x) => ({ mois: x.mois, montant: x.montant! })),
      entree: c.entree || null, sortie: c.sortie || null,
      ...(c.heuresSaisie === 'mois' && !c.enveloppe ? { heuresSaisie: 'mois' as const } : {}),
      ...(c.enveloppe ? { enveloppe: true } : {}),
      ...(c.extra ? { tauxHoraire: tauxHoraire! } : {}),
    },
    erreurs,
  }
}

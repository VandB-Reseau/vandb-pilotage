// Montants arrondis à l'euro (« 640 000 € ») ou en milliers (« 640 k€ ») dans les tableaux serrés
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, signDisplay: 'negative' })
const centimes = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const kilo = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'negative' })
const pourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'negative' })

export const montant = (v: number) => euros.format(v)
export const panier = (v: number) => centimes.format(v) // panier moyen, au centime
export const milliers = (v: number) => `${kilo.format(v / 1000)} k€`
export const taux = (v: number) => pourcent.format(v)

export const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
export const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const lienMagasin = (nom: string) => `/magasins/${encodeURIComponent(nom)}`

// Instant ISO en heure locale : « 21/10 à 14h32 »
export function dateHeure(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)} à ${d.getHours()}h${deux(d.getMinutes())}`
}

// Montant saisi remis en forme à la sortie du champ : « 60000 » → « 60 000 », « 1250,5 » → « 1 250,5 » ; illisible ou vide : tel quel
const saisie = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, useGrouping: true })
export function enChiffres(v: number): string { return saisie.format(v).replace(/[\u202f\u00a0]/g, ' ') }
export function miseEnForme(texte: string, lire: (s: string) => number | null): string {
  const v = lire(texte)
  return v === null || Number.isNaN(v) ? texte : enChiffres(v)
}

// Écarts signés : « +2 000 € », « −1,5 % », « +0,8 pt »
const ecartEuros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const ecartPourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const ecartNombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
const ecartPoints = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })
export const ecartMontant = (v: number) => ecartEuros.format(Math.round(v))
export const ecartTaux = (v: number) => ecartPourcent.format(v)
export const ecartChiffres = (v: number) => ecartNombre.format(Math.round(v)).replace(/[  ]/g, ' ')
export const ecartPts = (v: number) => `${ecartPoints.format(v * 100)} pt`
// Tableaux en k€ (lot 27) : une décimale au plus, sans unité dans la cellule (l'en-tête dit « En k€ »)
const enKilo = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
export const enMilliers = (v: number) => enKilo.format(Math.round(v / 100) / 10 || 0).replace(/[  ]/g, ' ')
// Libellé d'un quadrimestre de colonne : « Janv. – avr. »
export const QUADRIMESTRES_COURTS = ['Janv. – avr.', 'Mai – août', 'Sept. – déc.']

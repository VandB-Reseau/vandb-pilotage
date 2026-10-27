// Montants arrondis à l'euro (« 640 000 € ») ou en milliers (« 640 k€ ») dans les tableaux serrés
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const kilo = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const pourcent = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const montant = (v: number) => euros.format(v)
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

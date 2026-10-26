import Chip from '@mui/material/Chip'
import { statutLibelle, type Statut } from '../data/pilotage'

// Un seul rouge plein dans l'app : les autres états sont un texte coloré précédé d'un point (charte de l'app réseau)
export function PastilleStatut({ statut }: { statut: Statut | null }) {
  if (!statut) return <Chip size="small" variant="outlined" label="Pas de budget" />
  const couleur = statut === 'valide' ? 'success' : statut === 'en_discussion' ? 'warning' : 'info'
  return <Chip size="small" variant="filled" color={couleur} label={statutLibelle[statut]} />
}

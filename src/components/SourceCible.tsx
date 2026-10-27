import Chip from '@mui/material/Chip'
import { niveauLibelle, type Niveau } from '../moteur/cibles'

// D'où vient une hypothèse : un écart du magasin ressort, le reste est discret
export function SourceCible({ source }: { source: Niveau | 'base' }) {
  return <Chip size="small" variant={source === 'magasin' ? 'filled' : 'outlined'} color={source === 'magasin' ? 'warning' : 'default'} label={niveauLibelle[source]} />
}

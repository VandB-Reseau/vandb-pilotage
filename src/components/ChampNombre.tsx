import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import { nombre } from '../import/caisse'

// Saisie d'un montant ou d'un nombre, gardé en texte (« 12 500,40 ») ; rouge s'il est illisible
export function ChampNombre({ libelle, valeur, onChange, unite = '€', largeur = 140, desactive }: {
  libelle: string
  valeur: string
  onChange: (v: string) => void
  unite?: string
  largeur?: number
  desactive?: boolean
}) {
  return (
    <TextField
      size="small"
      value={valeur}
      disabled={desactive}
      error={Number.isNaN(nombre(valeur))}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': libelle, style: { textAlign: 'right' } },
        input: unite ? { endAdornment: <InputAdornment position="end">{unite}</InputAdornment> } : undefined,
      }}
      sx={{ width: largeur, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
    />
  )
}

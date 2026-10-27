import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

const bouton = { sx: { width: 48, height: 48 } }

// Choix d'un magasin dans une liste, avec recherche
export function ChoixMagasin({ libelle, options, valeur, onChange, desactive }: {
  libelle: string
  options: string[]
  valeur?: string | null
  onChange: (m: string | null) => void
  desactive?: boolean
}) {
  return (
    <Autocomplete
      options={options}
      value={valeur}
      disabled={desactive}
      onChange={(_, m) => onChange(m)}
      openText="Ouvrir la liste" closeText="Fermer la liste" clearText="Effacer" noOptionsText="Aucun magasin sans code caisse"
      slotProps={{ popupIndicator: bouton, clearIndicator: bouton }}
      sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
      renderInput={(p) => <TextField {...p} label={libelle} sx={{ '& .MuiInputBase-root': { py: 0 }, '& input': { height: 48, boxSizing: 'border-box' } }} />}
    />
  )
}

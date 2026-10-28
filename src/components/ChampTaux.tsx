import { useEffect, useState } from 'react'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'

const enTexte = (v: number | undefined) => (v === undefined ? '' : String(Math.round(v * 10_000) / 100).replace('.', ','))
const nettoyer = (t: string) => t.replace(',', '.').replace(/\s/g, '')
const lire = (t: string): number | undefined | null => {
  const x = nettoyer(t)
  if (x === '') return undefined
  return Number.isFinite(Number(x)) ? Number(x) / 100 : null
}

// Saisie d'un pourcentage (« 3,5 » pour 3,5 %). Vide : la valeur du niveau au-dessus s'applique, affichée en grisé.
export function ChampTaux({ libelle, valeur, heritee, onChange, desactive, largeur = 120, sansUnite }: {
  libelle: string
  valeur: number | undefined
  heritee?: number
  onChange: (v: number | undefined) => void
  desactive?: boolean
  largeur?: number
  sansUnite?: boolean // colonne déjà titrée en %
}) {
  const [texte, setTexte] = useState(enTexte(valeur))
  // Valeur changée ailleurs (retour à la cible) : le champ suit
  useEffect(() => { setTexte((t) => (lire(t) === valeur ? t : enTexte(valeur))) }, [valeur])
  const erreur = lire(texte) === null
  return (
    <TextField
      size="small"
      value={texte}
      disabled={desactive}
      error={erreur}
      placeholder={enTexte(heritee)}
      onChange={(e) => {
        setTexte(e.target.value)
        const v = lire(e.target.value)
        if (v !== null) onChange(v)
      }}
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': libelle, style: { textAlign: 'right' } },
        input: sansUnite ? undefined : { endAdornment: <InputAdornment position="end">%</InputAdornment> },
      }}
      sx={{ width: largeur, '& input': { height: 48, boxSizing: 'border-box', py: 0, px: sansUnite ? 1 : undefined } }}
    />
  )
}

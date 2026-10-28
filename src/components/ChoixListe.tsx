import TextField from '@mui/material/TextField'

// Liste déroulante native, à la hauteur des champs de saisie (48 px)
export function ChoixListe<T extends string | number>({ libelle, valeur, options, onChange, largeur = 140, desactive }: {
  libelle: string
  valeur: T
  options: { valeur: T; libelle: string }[]
  onChange: (v: T) => void
  largeur?: number
  desactive?: boolean
}) {
  return (
    <TextField
      select size="small" value={String(valeur)} disabled={desactive}
      onChange={(e) => { const o = options.find((x) => String(x.valeur) === e.target.value); if (o) onChange(o.valeur) }}
      slotProps={{ select: { native: true }, htmlInput: { 'aria-label': libelle } }}
      sx={{ width: largeur, '& select': { height: 48, boxSizing: 'border-box', py: 0, lineHeight: '48px' } }}
    >
      {options.map((o) => <option key={String(o.valeur)} value={String(o.valeur)}>{o.libelle}</option>)}
    </TextField>
  )
}

import { useEffect, useState, type KeyboardEvent } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import AddOutlined from '@mui/icons-material/AddOutlined'
import RemoveOutlined from '@mui/icons-material/RemoveOutlined'

const enTexte = (v: number | undefined) => (v === undefined ? '' : String(Math.round(v * 10_000) / 100).replace('.', ','))
const nettoyer = (t: string) => t.replace(',', '.').replace(/\s/g, '')
const lire = (t: string): number | undefined | null => {
  const x = nettoyer(t)
  if (x === '') return undefined
  return Number.isFinite(Number(x)) ? Number(x) / 100 : null
}

// Saisie d'un pourcentage (« 3,5 » pour 3,5 %). Vide : la valeur du niveau au-dessus s'applique, affichée en grisé.
// Proposition 3 (Joseph, 03/11/2026) : avec un pas, boutons − et + autour du champ, flèches haut et bas du clavier pour le
// même pas, Entrée pour passer à l'hypothèse suivante : on tâtonne sans retaper.
export function ChampTaux({ libelle, valeur, heritee, onChange, desactive, largeur = 120, sansUnite, marque, compact, pas }: {
  libelle: string
  valeur: number | undefined
  heritee?: number
  onChange: (v: number | undefined) => void
  desactive?: boolean
  largeur?: number
  sansUnite?: boolean // colonne déjà titrée en %
  marque?: boolean    // valeur propre au magasin, différente de la proposition : soulignée (lot 27)
  compact?: boolean   // tableau des hypothèses : 36 px de haut sur PC, 48 px sur téléphone
  pas?: number        // en fraction : 0,01 pour 1 point
}) {
  const [texte, setTexte] = useState(enTexte(valeur))
  // Valeur changée ailleurs (retour à la cible) : le champ suit
  useEffect(() => { setTexte((t) => (lire(t) === valeur ? t : enTexte(valeur))) }, [valeur])
  const erreur = lire(texte) === null
  const pousser = (sens: 1 | -1) => {
    if (!pas || desactive) return
    const depart = lire(texte) ?? valeur ?? heritee ?? 0
    const v = Math.round((depart + sens * pas) * 10_000) / 10_000
    setTexte(enTexte(v))
    onChange(v)
  }
  const clavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!pas) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); pousser(e.key === 'ArrowUp' ? 1 : -1) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const champs = [...document.querySelectorAll<HTMLInputElement>('input[data-hypothese]:not(:disabled)')]
      const i = champs.indexOf(e.target as HTMLInputElement)
      champs[i + 1]?.focus()
      champs[i + 1]?.select()
    }
  }
  const bouton = (sens: 1 | -1) => (
    // Doublon des flèches du clavier : caché aux lecteurs d'écran, qui passent par le champ (flèches haut et bas)
    <IconButton onClick={() => pousser(sens)} disabled={desactive} data-pas={sens > 0 ? 'monter' : 'baisser'} aria-hidden tabIndex={-1}
      sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 }, flexShrink: 0 }}>
      {sens > 0 ? <AddOutlined sx={{ fontSize: 18 }} /> : <RemoveOutlined sx={{ fontSize: 18 }} />}
    </IconButton>
  )
  const champ = (
    <TextField
      size="small"
      value={texte}
      disabled={desactive}
      error={erreur}
      placeholder={enTexte(heritee)}
      onKeyDown={clavier}
      onChange={(e) => {
        setTexte(e.target.value)
        const v = lire(e.target.value)
        if (v !== null) onChange(v)
      }}
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': libelle, style: { textAlign: 'right' }, ...(pas ? { 'data-hypothese': '' } : {}) },
        input: sansUnite ? undefined : { endAdornment: <InputAdornment position="end">%</InputAdornment> },
      }}
      sx={{
        width: pas ? { xs: Math.min(largeur, 80), md: largeur } : largeur, flexShrink: 0, '& input': { height: compact ? { xs: 48, md: 36 } : 48, boxSizing: 'border-box', py: 0, px: sansUnite ? 1 : undefined },
        ...(marque && !erreur ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'warning.main', borderWidth: 2 } } : {}),
      }}
    />
  )
  if (!pas) return champ
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {bouton(-1)}{champ}{bouton(1)}
    </Box>
  )
}

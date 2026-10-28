import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { usePreference } from '../lib/preferences'
import type { Periode } from '../moteur/periodes'

export type Unite = 'euros' | 'milliers'
const PERIODES: readonly Periode[] = ['mois', 'quadrimestre', 'annee']
const UNITES: readonly Unite[] = ['euros', 'milliers']
const libellePeriode: Record<Periode, string> = { mois: 'Mois', quadrimestre: 'Quadrimestres', annee: 'Année' }

// Période et unité d'un tableau sur 12 mois (lot 27), gardées dans ce navigateur pour tous les tableaux du même genre
export function usePeriode(cle: string) {
  const [periode, setPeriode] = usePreference<Periode>(`${cle}.periode`, 'mois', PERIODES)
  const [unite, setUnite] = usePreference<Unite>(`${cle}.unite`, 'euros', UNITES)
  return { periode, setPeriode, unite, setUnite }
}

export function ChoixPeriode({ quoi, periode, setPeriode, unite, setUnite }: ReturnType<typeof usePeriode> & { quoi: string }) {
  const bouton = { minHeight: { xs: 48, md: 36 }, px: 1.5, textTransform: 'none' as const }
  return (
    <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <ToggleButtonGroup exclusive size="small" value={periode} onChange={(_, v: Periode | null) => v && setPeriode(v)} aria-label={`Période : ${quoi}`}>
        {PERIODES.map((p) => <ToggleButton key={p} value={p} sx={bouton}>{libellePeriode[p]}</ToggleButton>)}
      </ToggleButtonGroup>
      <ToggleButtonGroup exclusive size="small" value={unite} onChange={(_, v: Unite | null) => v && setUnite(v)} aria-label={`Unité : ${quoi}`}>
        <ToggleButton value="euros" sx={bouton} aria-label="En euros">€</ToggleButton>
        <ToggleButton value="milliers" sx={bouton} aria-label="En milliers d’euros">k€</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}

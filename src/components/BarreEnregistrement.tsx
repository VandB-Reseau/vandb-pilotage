import { useEffect, useRef, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'

export interface Effet { libelle: string; avant: string; apres: string }

// Barre collée en bas de l'écran dès qu'une saisie n'est pas enregistrée (lot 27) : on enregistre sans remonter,
// et on voit l'effet des changements (avant → après) avant de le faire
export function BarreEnregistrement({ changements, effets = [], onAnnuler, onEnregistrer, libelle = 'Enregistrer', desactive, occupe, avertissement }: {
  changements: number
  effets?: Effet[]
  onAnnuler?: () => void
  onEnregistrer: () => void
  libelle?: string
  desactive?: boolean
  occupe?: boolean
  avertissement?: ReactNode
}) {
  // Ce qu'on fait défiler jusqu'à l'écran (champ suivant, bouton) ne se cache pas sous la barre
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const html = document.documentElement
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver(() => { html.style.scrollPaddingBottom = `calc(var(--barre-basse, 0px) + ${el.offsetHeight + 24}px)` })
    observateur.observe(el)
    return () => { observateur.disconnect(); html.style.scrollPaddingBottom = '' }
  }, [])
  return (
    <Box ref={ref} component="section" aria-label="Changements non enregistrés" className="pas-a-l-impression" sx={{
      // Au-dessus du menu bas du téléphone (--barre-basse, posé par AppShell)
      position: 'sticky', bottom: { xs: 'calc(var(--barre-basse, 0px) + 8px)', md: 16 }, zIndex: 5, display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2.5 }, flexWrap: 'wrap',
      bgcolor: 'grey.900', color: '#fff', borderRadius: 3, px: 2, py: 1.25, boxShadow: '0 -4px 18px rgba(0, 0, 0, 0.18)',
    }}>
      <Typography component="p" sx={{ fontWeight: 700 }}>{changements <= 1 ? '1 changement' : `${changements} changements`}</Typography>
      {/* Téléphone : les effets sur une ligne qui passe à la ligne au besoin, sans libellés longs */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: { xs: 1.5, md: 2.5 }, rowGap: 0.25 }}>
        {effets.map((e) => (
          <Typography key={e.libelle} component="p" sx={{ fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
            {e.libelle} <Box component="span" sx={{ color: 'grey.400' }}>{e.avant} →</Box> <b>{e.apres}</b>
          </Typography>
        ))}
      </Box>
      {avertissement && <Typography component="p" sx={{ fontSize: '0.875rem', color: 'warning.light' }}>{avertissement}</Typography>}
      <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
      <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' } }}>
        {onAnnuler && (
          <Button onClick={onAnnuler} disabled={occupe} aria-label="Annuler les changements" variant="outlined"
            sx={{ minHeight: 48, color: '#fff', borderColor: 'grey.500', flex: { xs: '0 0 auto', md: 'none' } }}>
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>Annuler les changements</Box>
            <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>Annuler</Box>
          </Button>
        )}
        <Button variant="contained" startIcon={<SaveOutlined />} onClick={onEnregistrer} disabled={occupe || desactive}
          sx={{ minHeight: 48, flex: { xs: 1, md: 'none' }, bgcolor: 'secondary.main', color: 'secondary.contrastText', '&:hover': { bgcolor: 'secondary.dark' } }}>{libelle}</Button>
      </Box>
    </Box>
  )
}

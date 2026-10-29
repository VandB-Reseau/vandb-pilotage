import { useId, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { AIDE, type SujetAide } from '../lib/aide'

// Icône d'aide : ce que c'est, comment le remplir, comment c'est calculé. Rien ne s'affiche tant qu'on ne la touche pas.
// compact : dans une ligne de tableau, l'icône ne grandit pas la ligne sur PC (48 px gardés sur téléphone)
export function Aide({ sujet, compact }: { sujet: SujetAide; compact?: boolean }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const id = useId()
  const t = AIDE[sujet]
  const bloc = (titre: string, texte?: string) => texte && (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{titre}</Typography>
      <Typography variant="body2" color="text.secondary">{texte}</Typography>
    </Box>
  )
  return (
    <>
      <IconButton
        aria-label={`Aide : ${t.titre}`} aria-describedby={ancre ? id : undefined} className="pas-a-l-impression"
        onClick={(e) => { e.stopPropagation(); setAncre(e.currentTarget) }}
        sx={{ width: { xs: 48, md: compact ? 24 : 32 }, height: { xs: 48, md: compact ? 24 : 32 }, my: compact ? { xs: -1.5, md: -0.5 } : 0, color: 'text.secondary', verticalAlign: 'middle' }}
      >
        <InfoOutlined sx={{ fontSize: compact ? 16 : 18 }} />
      </IconButton>
      <Popover
        id={id} open={!!ancre} anchorEl={ancre} onClose={() => setAncre(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': t.titre, sx: { p: 2, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 1.25, whiteSpace: 'normal', textAlign: 'left' } } }}
      >
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>{t.titre}</Typography>
        {bloc('C’est quoi', t.quoi)}
        {bloc('Comment le remplir', 'remplir' in t ? t.remplir : undefined)}
        {bloc('Comment c’est calculé', t.calcul)}
      </Popover>
    </>
  )
}

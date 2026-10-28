import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import { Courbe } from './Courbe'

// Carte de chiffre clé : libellé discret, valeur en grand, écart coloré (vert si favorable, rouge sinon), courbe facultative
export function Indicateur({ libelle, valeur, detail, ecart, serie, action }: {
  libelle: string
  valeur: string
  detail?: string
  ecart?: { texte: string; hausse: boolean; favorable: boolean }
  serie?: (number | null)[]
  action?: ReactNode
}) {
  return (
    <Card sx={{ p: 2.5, flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="p" sx={{ fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
        {ecart && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: '0.8125rem', fontWeight: 700, color: ecart.favorable ? 'success.dark' : 'error.main' }}>
            {ecart.hausse ? <ArrowUpwardOutlined sx={{ fontSize: 16 }} /> : <ArrowDownwardOutlined sx={{ fontSize: 16 }} />}
            {ecart.texte}
          </Box>
        )}
      </Box>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
      {serie && <Box sx={{ mt: 'auto', pt: 1 }}><Courbe valeurs={serie} /></Box>}
      {action}
    </Card>
  )
}

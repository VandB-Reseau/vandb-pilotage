import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'

// Section de Paramètres réseau. Lot 39 : chaque onglet ne montre que ses sections, ouvertes d'office ; une pastille tant
// que les valeurs sont celles proposées par défaut ; le bouton Enregistrer à droite du titre (absent en lecture seule).
export function SectionParametres({ nom, titre, parDefaut, action, children }: {
  nom: string
  titre: string
  parDefaut: boolean
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card component="section" aria-label={nom}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2, py: 1.5, minHeight: 64 }}>
        <Box sx={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h2" component="h2">{titre}</Typography>
          {parDefaut && (
            <Typography component="span" sx={{ fontSize: '0.8125rem', fontWeight: 700, px: 1.25, py: 0.25, borderRadius: 99, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              Valeurs par défaut
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Card>
  )
}

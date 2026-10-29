import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'

// Section de Paramètres réseau (lot 30, E4) : repliée, une ligne de résumé, une pastille tant que les valeurs sont
// celles proposées par défaut ; le bouton Enregistrer n'apparaît qu'une fois la section ouverte
export function SectionParametres({ nom, titre, resume, parDefaut, action, children }: {
  nom: string
  titre: string
  resume: string
  parDefaut: boolean
  action: ReactNode
  children: ReactNode
}) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <Card component="section" aria-label={nom}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', pr: 2 }}>
        <ButtonBase onClick={() => setOuverte(!ouverte)} aria-expanded={ouverte} aria-label={`${titre} : ${ouverte ? 'replier' : 'ouvrir'}`}
          sx={{ flex: 1, minWidth: 240, minHeight: 64, px: 2, py: 1.5, justifyContent: 'flex-start', textAlign: 'left', gap: 1.5, borderRadius: 2 }}>
          {ouverte ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h2" component="h2">{titre}</Typography>
              {parDefaut && (
                <Typography component="span" sx={{ fontSize: '0.8125rem', fontWeight: 700, px: 1.25, py: 0.25, borderRadius: 99, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                  Valeurs par défaut
                </Typography>
              )}
            </Box>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{resume}</Typography>
          </Box>
        </ButtonBase>
        {ouverte && action}
      </Box>
      {ouverte && children}
    </Card>
  )
}

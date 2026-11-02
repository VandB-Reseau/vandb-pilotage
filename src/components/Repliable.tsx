import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'

// Lot 38 (D3) : section de détail repliée par défaut ; le titre l'ouvre. Repliée, elle s'imprime quand même.
export function Repliable({ titre, nom, ouvert = false, droite, children }: {
  titre: string
  nom: string          // nom de la section pour les lecteurs d'écran
  ouvert?: boolean
  droite?: ReactNode   // à droite du titre (légende, choix d'affichage)
  children: ReactNode
}) {
  const [o, setO] = useState(ouvert)
  return (
    <Card component="section" aria-label={nom}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 2, flexWrap: 'wrap' }}>
        <ButtonBase onClick={() => setO(!o)} aria-expanded={o} sx={{ flex: 1, minWidth: 220, minHeight: 56, px: 2.5, justifyContent: 'flex-start', textAlign: 'left', gap: 1, borderRadius: 2 }}>
          {o ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
          <Typography variant="h2" component="h2">{titre}</Typography>
        </ButtonBase>
        {droite}
      </Box>
      <Box className={o ? undefined : 'repli-ferme'}>{children}</Box>
    </Card>
  )
}

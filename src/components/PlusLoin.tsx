import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { usePreference } from '../lib/preferences'

// « Pour aller plus loin » (lot 30, E2) : le détail de la synthèse, replié par défaut ; le choix est gardé dans le navigateur
export function PlusLoin({ contenu, children }: { contenu: string; children: ReactNode }) {
  const [ouvert, setOuvert] = usePreference<'ouvert' | 'ferme'>('plus-loin', 'ferme', ['ouvert', 'ferme'])
  return (
    <Box component="section" aria-label="Pour aller plus loin">
      <Button onClick={() => setOuvert(ouvert === 'ouvert' ? 'ferme' : 'ouvert')} aria-expanded={ouvert === 'ouvert'} className="pas-a-l-impression"
        endIcon={ouvert === 'ouvert' ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ minHeight: 48, fontSize: '1rem', fontWeight: 700 }}>
        Pour aller plus loin
        <Box component="span" sx={{ ml: 1, fontWeight: 400, color: 'text.secondary' }}>{contenu}</Box>
      </Button>
      {ouvert === 'ouvert' && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>{children}</Box>}
    </Box>
  )
}

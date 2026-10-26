import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import fleur from '../assets/illustrations/fleur.png'
import magasins from '../assets/illustrations/magasins.png'

// État vide : ce qui manque, pourquoi, et l'action possible. Pictogrammes de la charte, toujours sur fond blanc.
export function EtatVide({ titre, texte, action }: { titre: string; texte: string; action?: ReactNode }) {
  const image = /magasin|budget/i.test(titre) ? magasins : fleur
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
      <Box aria-hidden sx={{ display: 'inline-flex', p: 1.5, borderRadius: 4, mb: 2, bgcolor: '#ffffff' }}>
        <Box component="img" src={image} alt="" sx={{ height: 96, width: 'auto', display: 'block' }} />
      </Box>
      <Typography variant="h4" component="p" color="text.primary" gutterBottom>{titre}</Typography>
      <Typography variant="body2" sx={{ maxWidth: 420, mx: 'auto' }}>{texte}</Typography>
      {action && <Box sx={{ mt: 3 }}>{action}</Box>}
    </Box>
  )
}

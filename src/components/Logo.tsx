import Box from '@mui/material/Box'
import logoBlanc from '../assets/logo-vandb-blanc.png'

// Logo officiel V and B (charte, version blanche pour fond noir), embarqué dans l'app
export function Logo({ size = 22 }: { size?: number }) {
  const hauteur = Math.round(size * 1.8)
  return <Box component="img" src={logoBlanc} alt="V and B" role="img" sx={{ height: hauteur, width: 'auto', display: 'block' }} />
}

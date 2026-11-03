import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'

// Lot 42 (proposition 6) : pour chaque thème, le franchisé dit « D'accord » avec le siège, ou change ce qui le gêne.
// Un thème changé l'affiche ; un thème accepté peut être repris d'un clic. Rien pour les autres rôles.
export function AccordTheme({ nom, change, accepte, onChange }: { nom: string; change: boolean; accepte: boolean; onChange: (accepte: boolean) => void }) {
  if (change) {
    return <Chip icon={<EditOutlined />} label="Changé par le magasin" variant="outlined" sx={{ height: 32, fontWeight: 700 }} aria-label={`${nom} : changé par le magasin`} />
  }
  return (
    <Box>
      <Button
        variant={accepte ? 'contained' : 'outlined'} color="success" startIcon={accepte ? <CheckCircleOutlined /> : undefined}
        aria-pressed={accepte} aria-label={`${nom} : d’accord avec le siège`} onClick={() => onChange(!accepte)} sx={{ minHeight: 48 }}>
        {accepte ? 'D’accord' : 'D’accord avec le siège'}
      </Button>
    </Box>
  )
}

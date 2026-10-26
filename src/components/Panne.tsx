import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

// Message humain quand la base ne répond pas, avec une nouvelle tentative
export function Panne({ quoi, recharger }: { quoi: string; recharger: () => void }) {
  return (
    <Alert severity="error" action={<Button color="inherit" onClick={recharger} sx={{ minHeight: 48 }}>Réessayer</Button>} sx={{ alignItems: 'center' }}>
      {quoi} ne se chargent pas pour le moment. Vérifie ta connexion, puis réessaie.
    </Alert>
  )
}

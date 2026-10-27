import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'

export function Indicateur({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <Card sx={{ p: 2, flex: '1 1 160px' }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="h3" component="p" sx={{ mt: 0.5 }}>{valeur}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Card>
  )
}

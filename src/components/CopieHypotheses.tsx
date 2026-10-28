import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Typography from '@mui/material/Typography'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'

// Directeur : reprendre les hypothèses d'un magasin sur d'autres magasins dont le budget n'est pas validé
export function CopieHypotheses({ source, magasins, occupe, onCopier, onFermer }: {
  source: string
  magasins: string[]
  occupe: boolean
  onCopier: (vers: string[]) => void
  onFermer: () => void
}) {
  const [choisis, setChoisis] = useState<string[]>([])
  const tous = choisis.length === magasins.length && magasins.length > 0
  return (
    <Card component="section" aria-labelledby="titre-copie" sx={{ p: 2.5 }}>
      <Typography id="titre-copie" variant="h2">Copier les hypothèses de {source}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Évolutions, marges, démarques, salaires, frais, tickets et saisonnalité remplacent ceux des magasins cochés ; leurs travaux restent.
      </Typography>
      {magasins.length === 0 ? (
        <Typography variant="body2">Aucun autre magasin n’a de budget proposé ou en discussion.</Typography>
      ) : (
        <>
          <FormControlLabel
            control={<Checkbox checked={tous} indeterminate={!tous && choisis.length > 0} onChange={() => setChoisis(tous ? [] : magasins)} />}
            label="Tous" sx={{ minHeight: 48, fontWeight: 700 }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, columnGap: 2 }}>
            {magasins.map((m) => (
              <FormControlLabel key={m} label={m} sx={{ minHeight: 48 }}
                control={<Checkbox checked={choisis.includes(m)} onChange={() => setChoisis((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]))} />} />
            ))}
          </Box>
        </>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
        <Button onClick={onFermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" startIcon={<ContentCopyOutlined />} disabled={occupe || choisis.length === 0} onClick={() => onCopier(choisis)} sx={{ minHeight: 48 }}>
          {choisis.length > 1 ? `Copier vers ${choisis.length} magasins` : 'Copier'}
        </Button>
      </Box>
    </Card>
  )
}

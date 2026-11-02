import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { ecartMilliers, MOIS_LONGS } from '../lib/format'
import { Aide } from './Aide'
import type { EcartExplique, EffetEcart } from '../moteur/ecartExplique'

// Lot 41, proposition 5 : d'où vient l'écart au budget, à fin du dernier mois réalisé. Une barre par effet, à gauche
// (rouge) quand il coûte, à droite (vert) quand il rapporte, toutes à la même échelle.
function Ligne({ e, max }: { e: EffetEcart; max: number }) {
  const part = max > 0 ? Math.min(50, (Math.abs(e.effet) / max) * 50) : 0
  const negatif = e.effet < 0
  return (
    <Box component="li" sx={{ display: 'grid', gridTemplateColumns: { xs: '8.5rem 1fr 4.5rem', sm: '11rem 1fr 5rem' }, alignItems: 'center', gap: 1.5, minHeight: 32 }}>
      <Typography variant="body2">{e.libelle}</Typography>
      <Box aria-hidden sx={{ position: 'relative', height: 12, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Box sx={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: '1px', bgcolor: 'text.secondary' }} />
        <Box sx={{ position: 'absolute', top: 1, height: 10, borderRadius: 0.5, left: negatif ? `${50 - part}%` : '50%', width: `${part}%`, bgcolor: negatif ? 'error.main' : 'success.main' }} />
      </Box>
      <Typography variant="body2" sx={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: Math.abs(e.effet) < 50 ? 'text.secondary' : negatif ? 'error.main' : 'success.dark' }}>
        {ecartMilliers(e.effet)}
      </Typography>
    </Box>
  )
}

export function EcartExpliqueCarte({ e }: { e: EcartExplique }) {
  const marge: EffetEcart[] = [
    { cle: 'effetCA', libelle: 'Effet du CA', effet: e.marge.effetCA },
    ...(e.marge.effetTaux === null ? [] : [{ cle: 'effetTaux', libelle: 'Effet du taux de marge', effet: e.marge.effetTaux }]),
  ]
  const max = Math.max(...e.ca.map((x) => Math.abs(x.effet)), ...marge.map((x) => Math.abs(x.effet)))
  const totalMarge = e.marge.effetCA + (e.marge.effetTaux ?? 0)
  return (
    <Card component="section" aria-label="D’où vient l’écart au budget" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
        <Typography variant="h2">D’où vient l’écart au budget, à fin {MOIS_LONGS[e.moisRealises - 1]}</Typography>
        <Aide sujet="ecartExplique" />
      </Box>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Chiffre d’affaires : {ecartMilliers(e.ecartCA)}</Typography>
          <Box component="ul" aria-label="Écart de chiffre d’affaires par effet" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
            {e.ca.map((x) => <Ligne key={x.cle} e={x} max={max} />)}
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Marge : {ecartMilliers(totalMarge)}</Typography>
          <Box component="ul" aria-label="Écart de marge par effet" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
            {marge.map((x) => <Ligne key={x.cle} e={x} max={max} />)}
          </Box>
          {e.marge.effetTaux === null && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Marge absente des chiffres de caisse : seul l’effet du CA se calcule.</Typography>}
        </Box>
      </Box>
    </Card>
  )
}

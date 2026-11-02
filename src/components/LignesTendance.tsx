import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { ecartMontant, ecartTaux, milliers } from '../lib/format'
import { niveauEcart, tendance } from '../moteur/visuel'
import { brand } from '../theme/theme'
import { Pastille } from './Tableau'

export interface LigneTendance { libelle: string; reel: (number | null)[]; reference: (number | null)[]; nomReference: string; format?: (v: number) => string }

// Lignes à mini-courbe (refonte T3, 2/11/2026) : un grand chiffre par ligne, la tendance des 12 mois en petit (réel en vert
// canard, la référence en gris), le cumul et l'écart à droite. Lisible sans tableau, sur PC comme sur téléphone.
export function LignesTendance({ titre, lignes, seuil }: { titre: string; lignes: LigneTendance[]; seuil: number }) {
  const visibles = lignes.map((l) => ({ l, t: tendance(l.reel, l.reference) })).filter((x) => x.t !== null)
  if (!visibles.length) return null
  return (
    <Card component="section" aria-label={titre}>
      <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>{titre}</Typography>
      <Box role="list">
        {visibles.map(({ l, t }) => {
          const f = l.format ?? milliers
          const niveau = niveauEcart(t!.reel, t!.reference, seuil)
          return (
            <Box key={l.libelle} role="listitem" aria-label={l.libelle} sx={{
              display: 'grid', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider',
              gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(150px, 1.2fr) minmax(140px, 1.6fr) 1fr 1fr' },
            }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>{l.libelle}</Typography>
                <Typography variant="caption" color="text.secondary">face {l.nomReference}, {t!.mois} mois</Typography>
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, order: { xs: 3, sm: 0 } }}><MiniCourbe reel={l.reel} reference={l.reference} /></Box>
              <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: 700 }}><Pastille niveau={niveau} />{f(t!.reel)}</Box>
                <Typography variant="caption" color="text.secondary" component="div">{l.nomReference.replace(/^(au |à l’|à )/, '')} {f(t!.reference)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' }, color: t!.ecart >= 0 ? 'success.dark' : 'error.main', fontWeight: 700 }}>
                {l.format ? `${t!.ecart >= 0 ? '+' : '−'}${l.format(Math.abs(t!.ecart))}` : ecartMontant(t!.ecart)}
                {t!.part !== null && <Typography variant="caption" component="div" sx={{ color: 'inherit', fontWeight: 400 }}>{ecartTaux(t!.part)}</Typography>}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Card>
  )
}

// Deux courbes sur 12 mois, sans axe : la référence en gris, le réel en vert canard avec son dernier point
function MiniCourbe({ reel, reference }: { reel: (number | null)[]; reference: (number | null)[] }) {
  const L = 200, H = 40
  const toutes = [...reel, ...reference].filter((v): v is number => v !== null)
  const max = Math.max(...toutes), min = Math.min(...toutes)
  const x = (i: number) => 3 + (i / 11) * (L - 6)
  const y = (v: number) => H - 4 - ((v - min) / Math.max(1, max - min)) * (H - 8)
  const chemin = (s: (number | null)[]) => s.reduce<string>((a, v, i) => (v === null ? a : `${a}${a && s[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `), '')
  const dernier = reel.reduce<number>((d, v, i) => (v !== null ? i : d), -1)
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden style={{ display: 'block' }}>
      <path d={chemin(reference)} fill="none" stroke="var(--mui-palette-text-secondary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={chemin(reel)} fill="none" stroke={brand.vert} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      {dernier >= 0 && <circle cx={x(dernier)} cy={y(reel[dernier]!)} r={3} fill={brand.vert} />}
    </svg>
  )
}

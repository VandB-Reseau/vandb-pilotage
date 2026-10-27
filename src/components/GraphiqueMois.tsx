import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { MOIS, MOIS_LONGS } from '../lib/format'

// Graphique sur 12 mois : barres (réel, projection) et lignes (an dernier), sans cadre ;
// au survol d'un mois, une infobulle détaille chaque série
export interface Serie { nom: string; valeurs: (number | null)[]; forme: 'barre' | 'ligne'; couleur: string; pointille?: boolean }

const HAUT = 220, BAS = 28, GAUCHE = 52

export function GraphiqueMois({ titre, series, format, formatAxe }: {
  titre: string
  series: Serie[]
  format: (v: number) => string
  formatAxe: (v: number) => string
}) {
  const theme = useTheme()
  const boite = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(640)
  const [survol, setSurvol] = useState<number | null>(null)
  useEffect(() => {
    const el = boite.current
    if (!el) return
    const o = new ResizeObserver(([e]) => setLargeur(Math.max(280, e.contentRect.width)))
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const toutes = series.flatMap((s) => s.valeurs.filter((v): v is number => v !== null))
  const max = Math.max(1, ...toutes)
  // Graduation ronde : 1, 2 ou 5 × 10^n
  const pas = (() => { const brut = max / 3, p = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)! })()
  const haut = Math.ceil(max / pas) * pas
  const zone = largeur - GAUCHE - 8
  const colonne = zone / 12
  const x = (i: number) => GAUCHE + colonne * i + colonne / 2
  const y = (v: number) => HAUT - (v / haut) * (HAUT - 12)
  const barres = series.filter((s) => s.forme === 'barre')
  const lignes = series.filter((s) => s.forme === 'ligne')
  const largeurBarre = Math.min(28, colonne * 0.56)
  const texte = theme.palette.text.secondary

  return (
    <Box ref={boite} sx={{ position: 'relative' }} onMouseLeave={() => setSurvol(null)}>
      <svg role="img" aria-label={titre} width={largeur} height={HAUT + BAS} style={{ display: 'block' }}>
        {Array.from({ length: Math.round(haut / pas) + 1 }, (_, k) => k * pas).map((v) => (
          <g key={v}>
            <line x1={GAUCHE} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke={theme.palette.divider} />
            <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={texte}>{formatAxe(v)}</text>
          </g>
        ))}
        {survol !== null && <rect x={GAUCHE + colonne * survol} y={0} width={colonne} height={HAUT} fill={theme.palette.action.hover} />}
        {barres.map((s) => s.valeurs.map((v, i) => v !== null && v > 0 && (
          <rect key={`${s.nom}-${i}`} x={x(i) - largeurBarre / 2} y={y(v)} width={largeurBarre} height={HAUT - y(v)} rx={4} fill={s.couleur} />
        )))}
        {lignes.map((s) => {
          const pts = s.valeurs.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
          const d = pts.reduce<string>((acc, p, i) => (p === null ? acc : `${acc}${acc && pts[i - 1] !== null ? 'L' : 'M'}${p} `), '')
          return (
            <g key={s.nom}>
              <path d={d} fill="none" stroke={s.couleur} strokeWidth={2} strokeDasharray={s.pointille ? '5 4' : undefined} strokeLinejoin="round" />
              {s.valeurs.map((v, i) => v !== null && <circle key={i} cx={x(i)} cy={y(v)} r={survol === i ? 4.5 : 3} fill={s.couleur} />)}
            </g>
          )
        })}
        {MOIS.map((m, i) => <text key={m} x={x(i)} y={HAUT + 18} textAnchor="middle" fontSize={12} fill={texte}>{m}</text>)}
        {MOIS.map((m, i) => (
          <rect key={`zone-${m}`} data-mois={i + 1} x={GAUCHE + colonne * i} y={0} width={colonne} height={HAUT + BAS} fill="transparent"
            onMouseEnter={() => setSurvol(i)} onMouseMove={() => setSurvol(i)} onClick={() => setSurvol(i)} />
        ))}
      </svg>

      {survol !== null && (
        <Paper role="tooltip" elevation={0} sx={{
          position: 'absolute', top: 8, pointerEvents: 'none', px: 1.5, py: 1, minWidth: 180, borderRadius: 2,
          boxShadow: '0 4px 16px rgba(29, 29, 27, 0.14)',
          ...(x(survol) > largeur / 2 ? { right: largeur - x(survol) + colonne / 2 + 4 } : { left: x(survol) + colonne / 2 + 4 }),
        }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mb: 0.5 }}>{MOIS_LONGS[survol]}</Typography>
          {series.filter((s) => s.valeurs[survol] !== null).map((s) => (
            <Box key={s.nom} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8125rem' }}>
              <Box component="span" sx={{ width: 10, height: 10, borderRadius: s.forme === 'barre' ? '3px' : '50%', bgcolor: s.couleur, flexShrink: 0 }} />
              <Box component="span" sx={{ flex: 1, color: 'text.secondary' }}>{s.nom}</Box>
              <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{format(s.valeurs[survol]!)}</Box>
            </Box>
          ))}
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', mt: 1, pl: `${GAUCHE}px` }}>
        {series.filter((s) => s.valeurs.some((v) => v !== null)).map((s) => (
          <Box key={s.nom} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: '0.8125rem', color: 'text.secondary' }}>
            <Box component="span" sx={{ width: s.forme === 'barre' ? 10 : 16, height: s.forme === 'barre' ? 10 : 2, borderRadius: s.forme === 'barre' ? '3px' : 0, bgcolor: s.couleur }} />
            {s.nom}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { milliers, montant, MOIS, MOIS_LONGS } from '../lib/format'
import { plusGrosseSortie, type Tresorerie } from '../moteur/tresorerie'
import { LIGNES_TRESORERIE } from './TresorerieBudget'

const HAUT = 220, BAS = 28, GAUCHE = 60

// Trésorerie de fin de mois en barres (lot 27) : au-dessus de zéro en vert, à découvert en rouge, point bas annoté ;
// au survol d'un mois, encaissements, décaissements et la plus grosse sortie
export function GraphiqueTresorerie({ tresorerie: t, annee }: { tresorerie: Tresorerie; annee: number }) {
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

  const fins = t.mois.map((m) => m.fin)
  const haut0 = Math.max(0, ...fins), bas0 = Math.min(0, ...fins)
  const pas = (() => { const brut = Math.max(1, haut0 - bas0) / 4, p = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)! })()
  const haut = Math.ceil(haut0 / pas) * pas, bas = Math.floor(bas0 / pas) * pas
  const y = (v: number) => 8 + ((haut - v) / Math.max(1, haut - bas)) * (HAUT - 16)
  const colonne = (largeur - GAUCHE - 8) / 12
  const x = (i: number) => GAUCHE + colonne * i + colonne / 2
  const barre = Math.min(36, colonne * 0.6)
  const texte = theme.palette.text.secondary
  const bas_i = t.pointBas.mois
  const graduations = Array.from({ length: Math.round((haut - bas) / pas) + 1 }, (_, k) => bas + k * pas)
  const m = survol === null ? null : t.mois[survol]
  const sortie = m ? plusGrosseSortie(m) : null

  return (
    <Box ref={boite} sx={{ position: 'relative' }} onMouseLeave={() => setSurvol(null)}>
      <svg role="img" aria-label={`Trésorerie de fin de mois ${annee} : point bas ${milliers(t.pointBas.montant)} fin ${MOIS_LONGS[bas_i]}`} width={largeur} height={HAUT + BAS} style={{ display: 'block' }}>
        {graduations.map((v) => (
          <g key={v}>
            <line x1={GAUCHE} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? theme.palette.text.primary : theme.palette.divider} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={texte}>{milliers(v)}</text>
          </g>
        ))}
        {survol !== null && <rect x={GAUCHE + colonne * survol} y={0} width={colonne} height={HAUT} fill={theme.palette.action.hover} />}
        {fins.map((v, i) => (
          <rect key={i} x={x(i) - barre / 2} y={Math.min(y(0), y(v))} width={barre} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={3}
            fill={v >= 0 ? theme.palette.success.main : theme.palette.error.main} opacity={i === bas_i || v >= 0 ? 1 : 0.78} />
        ))}
        {t.pointBas.montant < 0 && (
          <text x={x(bas_i) + (bas_i > 6 ? -barre : barre)} y={Math.min(HAUT - 4, y(t.pointBas.montant) + 4)} textAnchor={bas_i > 6 ? 'end' : 'start'} fontSize={12} fontWeight={700} fill={theme.palette.error.main}>
            Point bas {milliers(t.pointBas.montant)}
          </text>
        )}
        {MOIS.map((n, i) => <text key={n} x={x(i)} y={HAUT + 18} textAnchor="middle" fontSize={12} fill={texte}>{n}</text>)}
        {MOIS.map((n, i) => (
          <rect key={`zone-${n}`} data-mois={i + 1} x={GAUCHE + colonne * i} y={0} width={colonne} height={HAUT + BAS} fill="transparent"
            onMouseEnter={() => setSurvol(i)} onMouseMove={() => setSurvol(i)} onClick={() => setSurvol(i)} />
        ))}
      </svg>
      {m && survol !== null && (
        <Paper role="tooltip" elevation={0} sx={{
          position: 'absolute', top: 8, pointerEvents: 'none', px: 1.5, py: 1, minWidth: 220, borderRadius: 2, boxShadow: '0 4px 16px rgba(29, 29, 27, 0.14)',
          ...(x(survol) > largeur / 2 ? { right: largeur - x(survol) + colonne / 2 + 4 } : { left: x(survol) + colonne / 2 + 4 }),
        }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>Fin {MOIS_LONGS[survol]}</Typography>
          {[
            ['Trésorerie', montant(m.fin)],
            ['Encaissements', montant(m.encaissements)],
            ['Décaissements', montant(-m.decaissements)],
            ...(sortie ? [[`Dont ${(LIGNES_TRESORERIE.find((l) => l.cle === sortie.cle)?.libelle ?? '').toLowerCase()}`, montant(-sortie.montant)]] : []),
          ].map(([l, v]) => (
            <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: '0.8125rem' }}><span>{l}</span><Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</Box></Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}

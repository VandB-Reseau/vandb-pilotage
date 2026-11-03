import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { milliers, montant, QUADRIMESTRES_COURTS } from '../lib/format'
import type { PlanTresorerie } from '../moteur/visuel'
import { brand } from '../theme/theme'
import { FOND_MOIS_EN_COURS } from './GraphiqueMois'

const HAUT = 240, BAS = 28, GAUCHE = 60

// Plan de trésorerie lu au quadrimestre (Joseph, 03/11/2026 : un curseur Mois / Quadrimestre remplace le second tableau).
// Trois colonnes : encaissé (réel plein dans le contour du prévu) et décaissé (réel déduit plein, sinon prévu en pointillé),
// solde de fin de période prévu en trait fin, solde réel saisi en gros point. Aucun calcul : tout vient de planTresorerie.
export function GraphiqueTresorerieQuadri({ plan, annee, quadriEnCours }: { plan: PlanTresorerie; annee: number; quadriEnCours?: number | null }) {
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

  const qs = plan.quadrimestres
  const valeurs = qs.flatMap((q) => [q.encPrevu, q.decPrevu, q.finPrevue, q.encReel, q.decReel, q.fin].filter((v): v is number => v !== null))
  const haut0 = Math.max(0, ...valeurs), bas0 = Math.min(0, ...qs.flatMap((q) => [q.finPrevue, q.fin].filter((v): v is number => v !== null)))
  const pas = (() => { const brut = Math.max(1, haut0 - bas0) / 4, p = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)! })()
  const haut = Math.ceil(haut0 / pas) * pas, bas = Math.floor(bas0 / pas) * pas
  const y = (v: number) => 8 + ((haut - v) / Math.max(1, haut - bas)) * (HAUT - 16)
  const colonne = (largeur - GAUCHE - 8) / 3
  const x = (i: number) => GAUCHE + colonne * i + colonne / 2
  const barre = Math.min(48, colonne * 0.22)
  const texte = theme.palette.text.secondary
  const noir = theme.palette.text.primary
  const enc = brand.vert, dec = brand.orange
  const graduations = Array.from({ length: Math.round((haut - bas) / pas) + 1 }, (_, k) => bas + k * pas)
  const rect = (cle: string, xi: number, v: number, couleur: string, plein: boolean, pointille?: boolean) => (
    <rect key={cle} x={xi} y={Math.min(y(0), y(v))} width={barre} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2}
      fill={plein ? couleur : 'none'} stroke={plein ? undefined : couleur} strokeWidth={plein ? undefined : 1.5} strokeDasharray={pointille ? '4 3' : undefined} />
  )
  const q = survol === null ? null : qs[survol]

  return (
    <Box ref={boite} sx={{ position: 'relative' }} onMouseLeave={() => setSurvol(null)}>
      <svg role="img" aria-label={`Trésorerie ${annee} par quadrimestre : fin de période ${qs.map((x, i) => `${QUADRIMESTRES_COURTS[i]} ${milliers(x.fin ?? x.finPrevue)}`).join(', ')}`}
        width={largeur} height={HAUT + BAS} style={{ display: 'block' }}>
        {quadriEnCours != null && <rect x={GAUCHE + colonne * quadriEnCours + 2} y={0} width={colonne - 4} height={HAUT + BAS} rx={6} fill={FOND_MOIS_EN_COURS} />}
        {graduations.map((v) => (
          <g key={v}>
            <line x1={GAUCHE} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? texte : theme.palette.divider} strokeWidth={1} />
            <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={texte}>{milliers(v)}</text>
          </g>
        ))}
        {survol !== null && <rect x={GAUCHE + colonne * survol} y={0} width={colonne} height={HAUT} fill={theme.palette.action.hover} />}
        {qs.map((r, i) => {
          const xe = x(i) - barre - 2, xd = x(i) + 2
          return (
            <g key={i}>
              {r.encReel !== null && rect('er', xe, r.encReel, enc, true)}
              {rect('ep', xe, r.encPrevu, r.encReel !== null ? texte : enc, false, r.encReel === null)}
              {r.decReel !== null ? rect('dr', xd, r.decReel, dec, true) : rect('dp', xd, r.decPrevu, dec, false, true)}
            </g>
          )
        })}
        <path d={qs.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.finPrevue).toFixed(1)}`).join(' ')} fill="none" stroke={texte} strokeWidth={1.5} />
        {qs.map((r, i) => <circle key={`p${i}`} cx={x(i)} cy={y(r.finPrevue)} r={3.5} fill={theme.palette.background.paper} stroke={texte} strokeWidth={1.5} />)}
        {qs.map((r, i) => r.fin !== null && <circle key={`r${i}`} cx={x(i)} cy={y(r.fin)} r={7} fill={r.fin < 0 ? theme.palette.error.main : noir} />)}
        {qs.map((_, i) => <text key={`t${i}`} x={x(i)} y={HAUT + 18} textAnchor="middle" fontSize={12} fill={i === quadriEnCours ? noir : texte} fontWeight={i === quadriEnCours ? 700 : 400}>{QUADRIMESTRES_COURTS[i]}</text>)}
        {qs.map((_, i) => (
          <rect key={`zone-${i}`} data-quadrimestre={i + 1} x={GAUCHE + colonne * i} y={0} width={colonne} height={HAUT + BAS} fill="transparent"
            onMouseEnter={() => setSurvol(i)} onMouseMove={() => setSurvol(i)} onClick={() => setSurvol(i)} />
        ))}
      </svg>
      {q && survol !== null && (
        <Paper role="tooltip" elevation={0} sx={{
          position: 'absolute', top: 8, pointerEvents: 'none', px: 1.5, py: 1, minWidth: 240, borderRadius: 2, boxShadow: '0 4px 16px rgba(29, 29, 27, 0.14)',
          ...(survol === 2 ? { right: largeur - x(survol) + colonne / 4 } : { left: x(survol) + colonne / 4 }),
        }}>
          <Typography variant="subtitle2">{QUADRIMESTRES_COURTS[survol]}</Typography>
          {[
            ...(q.fin !== null ? [['Trésorerie réelle en fin de période', montant(q.fin)]] : []),
            ['Trésorerie prévue en fin de période', montant(q.finPrevue)],
            ...(q.encReel !== null ? [['Encaissé en caisse', montant(q.encReel)]] : []),
            ['Encaissements prévus', montant(q.encPrevu)],
            ...(q.decReel !== null ? [['Décaissé, déduit du solde', montant(-q.decReel)]] : []),
            ['Décaissements prévus', montant(-q.decPrevu)],
          ].map(([l, v]) => (
            <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: '0.8125rem' }}><span>{l}</span><Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</Box></Box>
          ))}
        </Paper>
      )}
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', mt: 1, pl: `${GAUCHE}px`, fontSize: '0.8125rem', color: 'text.secondary' }} aria-hidden>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: enc }} />Encaissé en caisse</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: dec }} />Décaissé (pointillé : prévu)</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 16, height: 2, bgcolor: texte }} />Trésorerie prévue</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: noir }} />Trésorerie réelle saisie</Box>
      </Box>
    </Box>
  )
}

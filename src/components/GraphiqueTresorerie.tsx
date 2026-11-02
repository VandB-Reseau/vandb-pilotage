import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { milliers, montant, MOIS, MOIS_LONGS } from '../lib/format'
import { plusGrosseSortie, type Tresorerie } from '../moteur/tresorerie'
import type { PlanTresorerie } from '../moteur/visuel'
import { brand } from '../theme/theme'
import { FOND_MOIS_EN_COURS } from './GraphiqueMois'
import { LIGNES_TRESORERIE } from './TresorerieBudget'

const HAUT = 240, BAS = 28, GAUCHE = 60

// Plan de trésorerie (refonte P1, 2/11/2026, sur le modèle montré par Joseph) : chaque mois, l'encaissé (vert canard) et le
// décaissé (orange), le solde de fin de mois en courbe noire, le point bas annoté, le mois en cours surligné.
// Avec un « plan » (année en cours) : encaissé réel de la caisse en barre pleine dans le contour du prévu, solde réel aux
// fins de quadrimestre en gros points, puis projection en pointillé depuis le dernier solde réel ; le prévu en trait fin.
// Sans plan (budget) : tout est prévu, barres pleines.
export function GraphiqueTresorerie({ tresorerie: t, annee, plan, moisEnCours }: { tresorerie: Tresorerie; annee: number; plan?: PlanTresorerie; moisEnCours?: number | null }) {
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
  const encs = t.mois.map((m) => m.encaissements + m.consignesRemboursees)
  const decs = t.mois.map((m) => m.decaissements)
  const reels = plan ? plan.mois.flatMap((m) => [m.encReel, m.finReelle, m.finProjetee].filter((v): v is number => v !== null)) : []
  const haut0 = Math.max(0, ...fins, ...encs, ...decs, ...reels), bas0 = Math.min(0, ...fins, ...reels)
  const pas = (() => { const brut = Math.max(1, haut0 - bas0) / 4, p = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)! })()
  const haut = Math.ceil(haut0 / pas) * pas, bas = Math.floor(bas0 / pas) * pas
  const y = (v: number) => 8 + ((haut - v) / Math.max(1, haut - bas)) * (HAUT - 16)
  const colonne = (largeur - GAUCHE - 8) / 12
  const x = (i: number) => GAUCHE + colonne * i + colonne / 2
  const barre = Math.min(16, colonne * 0.3)
  const texte = theme.palette.text.secondary
  const noir = theme.palette.text.primary
  const enc = brand.vert, dec = brand.orange
  const graduations = Array.from({ length: Math.round((haut - bas) / pas) + 1 }, (_, k) => bas + k * pas)
  const bas_ = plan?.pointBas ?? { montant: t.pointBas.montant, mois: t.pointBas.mois }
  const m = survol === null ? null : t.mois[survol]
  const p = survol === null || !plan ? null : plan.mois[survol]
  const sortie = m ? plusGrosseSortie(m) : null
  const chemin = (pts: (number | null)[]) => pts.reduce<string>((acc, v, i) => (v === null ? acc : `${acc}${acc && pts[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `), '')
  const rectBarre = (cle: string, xi: number, v: number, couleur: string, plein: boolean, pointille?: boolean) => (
    <rect key={cle} x={xi} y={Math.min(y(0), y(v))} width={barre} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={2}
      fill={plein ? couleur : 'none'} stroke={plein ? undefined : couleur} strokeWidth={plein ? undefined : 1.5} strokeDasharray={pointille ? '4 3' : undefined} />
  )

  return (
    <Box ref={boite} sx={{ position: 'relative' }} onMouseLeave={() => setSurvol(null)}>
      <svg role="img" aria-label={`Trésorerie de fin de mois ${annee} : point bas ${milliers(bas_.montant)} fin ${MOIS_LONGS[bas_.mois]}`} width={largeur} height={HAUT + BAS} style={{ display: 'block' }}>
        {moisEnCours != null && <rect x={GAUCHE + colonne * moisEnCours + 2} y={0} width={colonne - 4} height={HAUT + BAS} rx={6} fill={FOND_MOIS_EN_COURS} />}
        {graduations.map((v) => (
          <g key={v}>
            <line x1={GAUCHE} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? texte : theme.palette.divider} strokeWidth={1} />
            <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={texte}>{milliers(v)}</text>
          </g>
        ))}
        {survol !== null && <rect x={GAUCHE + colonne * survol} y={0} width={colonne} height={HAUT} fill={theme.palette.action.hover} />}
        {t.mois.map((_, i) => {
          const xe = x(i) - barre - 1, xd = x(i) + 1
          if (!plan) return <g key={i}>{rectBarre('e', xe, encs[i], enc, true)}{rectBarre('d', xd, decs[i], dec, true)}</g>
          const r = plan.mois[i]
          return (
            <g key={i}>
              {r.encReel !== null && rectBarre('er', xe, r.encReel, enc, true)}
              {rectBarre('ep', xe, r.encPrevu, r.encReel !== null ? texte : enc, false, r.encReel === null)}
              {rectBarre('dp', xd, r.decPrevu, dec, false, true)}
            </g>
          )
        })}
        {plan ? (
          <>
            <path d={chemin(plan.mois.map((q) => q.finPrevue))} fill="none" stroke={texte} strokeWidth={1.5} strokeLinejoin="round" />
            <path d={chemin(plan.mois.map((q) => q.finProjetee))} fill="none" stroke={noir} strokeWidth={2.5} strokeDasharray="6 5" strokeLinejoin="round" />
            {plan.mois.map((q, i) => q.finReelle !== null && <circle key={i} cx={x(i)} cy={y(q.finReelle)} r={6} fill={noir} />)}
          </>
        ) : (
          <>
            <path d={chemin(fins)} fill="none" stroke={noir} strokeWidth={2.5} strokeLinejoin="round" />
            {fins.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={v < 0 ? theme.palette.error.main : noir} />)}
          </>
        )}
        {(bas_.montant < 0 || plan) && (
          <text x={x(bas_.mois) + (bas_.mois > 6 ? -10 : 10)} y={Math.max(14, Math.min(HAUT - 4, y(bas_.montant) - 10))} textAnchor={bas_.mois > 6 ? 'end' : 'start'} fontSize={12} fontWeight={700}
            fill={bas_.montant < 0 ? theme.palette.error.main : noir}>
            Point bas {milliers(bas_.montant)}
          </text>
        )}
        {MOIS.map((n, i) => <text key={n} x={x(i)} y={HAUT + 18} textAnchor="middle" fontSize={12} fill={i === moisEnCours ? noir : texte} fontWeight={i === moisEnCours ? 700 : 400}>{n}</text>)}
        {MOIS.map((n, i) => (
          <rect key={`zone-${n}`} data-mois={i + 1} x={GAUCHE + colonne * i} y={0} width={colonne} height={HAUT + BAS} fill="transparent"
            onMouseEnter={() => setSurvol(i)} onMouseMove={() => setSurvol(i)} onClick={() => setSurvol(i)} />
        ))}
      </svg>
      {m && survol !== null && (
        <Paper role="tooltip" elevation={0} sx={{
          position: 'absolute', top: 8, pointerEvents: 'none', px: 1.5, py: 1, minWidth: 240, borderRadius: 2, boxShadow: '0 4px 16px rgba(29, 29, 27, 0.14)',
          ...(x(survol) > largeur / 2 ? { right: largeur - x(survol) + colonne / 2 + 4 } : { left: x(survol) + colonne / 2 + 4 }),
        }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>Fin {MOIS_LONGS[survol]}</Typography>
          {[
            ...(p?.finReelle != null ? [['Trésorerie réelle', montant(p.finReelle)]] : p?.finProjetee != null ? [['Trésorerie projetée', montant(p.finProjetee)]] : []),
            [plan ? 'Trésorerie prévue' : 'Trésorerie', montant(m.fin)],
            ...(p?.encReel != null ? [['Encaissé en caisse', montant(p.encReel)]] : []),
            [plan ? 'Encaissements prévus' : 'Encaissements', montant(encs[survol])],
            [plan ? 'Décaissements prévus' : 'Décaissements', montant(-m.decaissements)],
            ...(sortie ? [[`Dont ${(LIGNES_TRESORERIE.find((l) => l.cle === sortie.cle)?.libelle ?? '').toLowerCase()}`, montant(-sortie.montant)]] : []),
          ].map(([l, v]) => (
            <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: '0.8125rem' }}><span>{l}</span><Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</Box></Box>
          ))}
        </Paper>
      )}
      <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', mt: 1, pl: `${GAUCHE}px`, fontSize: '0.8125rem', color: 'text.secondary' }} aria-hidden>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: enc }} />{plan ? 'Encaissé en caisse' : 'Encaissements'}</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', ...(plan ? { border: `1.5px dashed ${dec}` } : { bgcolor: dec }) }} />{plan ? 'Décaissements prévus' : 'Décaissements'}</Box>
        {plan && <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', border: `1.5px solid ${texte}` }} />Prévu</Box>}
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 16, height: 2, bgcolor: plan ? texte : noir }} />{plan ? 'Trésorerie prévue' : 'Trésorerie de fin de mois'}</Box>
        {plan && <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}><Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: noir }} />Trésorerie réelle (quadrimestre), puis projetée</Box>}
      </Box>
    </Box>
  )
}

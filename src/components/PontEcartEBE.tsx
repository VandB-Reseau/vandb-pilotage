import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { ecartMilliers, ecartMontant, milliers } from '../lib/format'
import type { PontEBE } from '../moteur/visuel'
import { Aide } from './Aide'

const HAUT = 220, BAS = 40, GAUCHE = 60

// Pont d'écart de l'EBE (refonte R3, 2/11/2026) : de l'EBE budgété à l'EBE réel, une marche par poste, verte si elle fait
// gagner, brique si elle fait perdre ; la plus grosse marche est celle dont on parle en visite.
export function PontEcartEBE({ pont, periode }: { pont: PontEBE; periode: string }) {
  const theme = useTheme()
  const boite = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(640)
  useEffect(() => {
    const el = boite.current
    if (!el) return
    const o = new ResizeObserver(([e]) => setLargeur(Math.max(600, e.contentRect.width)))
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const etapes = [
    { libelle: 'EBE budgété', montant: pont.budget, base: true },
    ...pont.marches.map((m) => ({ libelle: m.libelle, montant: m.montant, base: false })),
    { libelle: 'EBE réel', montant: pont.reel, base: true },
  ]
  // Niveaux successifs, pour l'échelle et le dessin
  let niveau = 0
  const blocs = etapes.map((e) => {
    if (e.base) { niveau = e.montant; return { ...e, de: 0, a: e.montant } }
    const de = niveau
    niveau += e.montant
    return { ...e, de, a: niveau }
  })
  const valeurs = blocs.flatMap((b) => [b.de, b.a])
  const haut0 = Math.max(0, ...valeurs), bas0 = Math.min(0, ...valeurs)
  const pas = (() => { const brut = Math.max(1, haut0 - bas0) / 4, p = 10 ** Math.floor(Math.log10(brut)); return [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)! })()
  const haut = Math.ceil(haut0 / pas) * pas, bas = Math.floor(bas0 / pas) * pas
  const y = (v: number) => 22 + ((haut - v) / Math.max(1, haut - bas)) * (HAUT - 30)
  const colonne = (largeur - GAUCHE - 8) / blocs.length
  const x = (i: number) => GAUCHE + colonne * i + colonne / 2
  const barre = Math.min(56, colonne * 0.6)
  const texte = theme.palette.text.secondary
  const couleur = (b: (typeof blocs)[number]) => (b.base ? theme.palette.text.primary : b.montant >= 0 ? theme.palette.success.main : theme.palette.error.main)
  const graduations = Array.from({ length: Math.round((haut - bas) / pas) + 1 }, (_, k) => bas + k * pas)
  const plusGrosse = pont.marches.reduce((a, m) => (Math.abs(m.montant) > Math.abs(a.montant) ? m : a), pont.marches[0])
  // Libellés sur deux lignes quand la colonne est étroite
  const coupe = (t: string) => (colonne < 110 && t.includes(' ') ? [t.slice(0, t.indexOf(' ')), t.slice(t.indexOf(' ') + 1)] : [t])

  return (
    <Card component="section" aria-label={`Du budget au réel : EBE ${periode}`} sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Typography variant="h2">Du budget au réel : EBE {periode}</Typography><Aide sujet="pontEBE" />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Écart {ecartMilliers(pont.reel - pont.budget)} ; le poste qui pèse le plus : {plusGrosse.libelle.toLowerCase()} ({ecartMilliers(plusGrosse.montant)}).
      </Typography>
      <Box ref={boite} sx={{ overflowX: 'auto' }}>
        <svg role="img" width={largeur} height={HAUT + BAS} style={{ display: 'block' }}
          aria-label={`De ${milliers(pont.budget)} budgétés à ${milliers(pont.reel)} réels : ${pont.marches.map((m) => `${m.libelle.toLowerCase()} ${ecartMontant(m.montant)}`).join(', ')}`}>
          {graduations.map((v) => (
            <g key={v}>
              <line x1={GAUCHE} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke={v === 0 ? texte : theme.palette.divider} />
              <text x={GAUCHE - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill={texte}>{milliers(v)}</text>
            </g>
          ))}
          {blocs.map((b, i) => {
            const y1 = y(Math.max(b.de, b.a)), y2 = y(Math.min(b.de, b.a))
            return (
              <g key={b.libelle}>
                <rect x={x(i) - barre / 2} y={y1} width={barre} height={Math.max(2, y2 - y1)} rx={3} fill={couleur(b)} />
                {i < blocs.length - 1 && <line x1={x(i) + barre / 2} x2={x(i + 1) - barre / 2} y1={y(b.a)} y2={y(b.a)} stroke={texte} strokeDasharray="3 3" />}
                <text x={x(i)} y={y1 - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={couleur(b)}>
                  {b.base ? milliers(b.montant) : `${b.montant >= 0 ? '+' : '−'}${milliers(Math.abs(b.montant))}`}
                </text>
                {coupe(b.libelle).map((l, k) => <text key={l} x={x(i)} y={HAUT + 14 + k * 14} textAnchor="middle" fontSize={12} fill={texte}>{l}</text>)}
              </g>
            )
          })}
        </svg>
      </Box>
    </Card>
  )
}

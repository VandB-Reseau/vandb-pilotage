import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import type { SujetAide } from '../lib/aide'
import { Aide } from './Aide'
import { Courbe } from './Courbe'
import { COULEUR_NIVEAU } from './Tableau'
import type { NiveauEcart } from '../moteur/visuel'

// Carte de chiffre clé : libellé discret, valeur en grand, écart coloré (vert si favorable, rouge sinon), courbe facultative.
// Lot 32 : picto (i) à côté du libellé, l'aide du calcul (aide) ou le calcul détaillé avec les chiffres du magasin (info)
// Refonte R4 (2/11/2026) : jauge facultative, le réel rempli à la couleur de sa pastille, un trait noir au niveau du budget
// (le budget est aux 4/5 de la jauge, pour voir aussi un dépassement)
export function Indicateur({ libelle, valeur, detail, ecart, serie, action, aide, info, jauge }: {
  libelle: string
  valeur: string
  detail?: string
  ecart?: { texte: string; hausse: boolean; favorable: boolean }
  serie?: (number | null)[]
  action?: ReactNode
  aide?: SujetAide
  info?: ReactNode
  jauge?: { valeur: number; cible: number; niveau: NiveauEcart | null; libelle: string }
}) {
  return (
    <Card sx={{ p: 2.5, flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minHeight: { xs: 48, md: 32 }, my: { xs: -1, md: -0.75 } }}>
        <Typography variant="body2" color="text.secondary">{libelle}</Typography>
        {aide && <Aide sujet={aide} />}
        {info}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="p" sx={{ fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
        {ecart && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontSize: '0.8125rem', fontWeight: 700, color: ecart.favorable ? 'success.dark' : 'error.main' }}>
            {ecart.hausse ? <ArrowUpwardOutlined sx={{ fontSize: 16 }} /> : <ArrowDownwardOutlined sx={{ fontSize: 16 }} />}
            {ecart.texte}
          </Box>
        )}
      </Box>
      {jauge && jauge.cible > 0 && (
        <Box role="meter" aria-label={jauge.libelle} aria-valuemin={0} aria-valuemax={Math.round(jauge.cible * 1.25)} aria-valuenow={Math.round(Math.max(0, jauge.valeur))}
          sx={{ position: 'relative', height: 10, borderRadius: 5, bgcolor: 'divider', my: 0.75 }}>
          <Box sx={{ position: 'absolute', inset: 0, right: 'auto', width: `${Math.max(0, Math.min(1, jauge.valeur / (jauge.cible * 1.25))) * 100}%`, borderRadius: 5, bgcolor: jauge.niveau ? COULEUR_NIVEAU[jauge.niveau] : 'text.secondary' }} />
          <Box sx={{ position: 'absolute', top: -4, bottom: -4, left: 'calc(80% - 1.5px)', width: 3, borderRadius: 2, bgcolor: 'text.primary' }} />
        </Box>
      )}
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
      {serie && <Box sx={{ mt: 'auto', pt: 1 }}><Courbe valeurs={serie} /></Box>}
      {action}
    </Card>
  )
}

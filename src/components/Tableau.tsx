import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import TableCell from '@mui/material/TableCell'
import Tooltip from '@mui/material/Tooltip'
import { ecartMontant, ecartTaux, MOIS } from '../lib/format'
import type { NiveauEcart } from '../moteur/visuel'
import { ecartReelPrevu } from '../moteur/visuel'
import { brand } from '../theme/theme'

// Briques communes des tableaux (refonte visuelle, 2/11/2026). Le texte réservé aux lecteurs d'écran reste dans un bloc en
// position relative : sinon, placé hors du tableau qui défile, il élargit la page sur téléphone.
const cache = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

// Couleur de la pastille : vert au prévu ou mieux, jaune-or dans le seuil, brique au-delà
export const COULEUR_NIVEAU: Record<NiveauEcart, string> = { favorable: 'success.main', leger: brand.or, fort: 'error.main' }
const TEXTE_NIVEAU: Record<NiveauEcart, string> = { favorable: 'au prévu ou mieux', leger: 'un peu en dessous du prévu', fort: 'nettement en dessous du prévu' }

export function Pastille({ niveau }: { niveau: NiveauEcart | null }) {
  if (!niveau) return null
  return <Box component="span" aria-hidden sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: COULEUR_NIVEAU[niveau], display: 'inline-block', flexShrink: 0 }} />
}

// En-tête d'un mois : le nom, et dessous, en petit, réel / en cours / prévu (facultatif) ; mois en cours surligné
export function EnTeteMois({ mois, sous, enCours }: { mois: number; sous?: string; enCours?: boolean }) {
  return (
    <TableCell align="right" className={enCours ? 'en-cours' : undefined} aria-label={sous ? `${MOIS[mois]} (${sous})` : undefined}>
      {MOIS[mois]}
      {sous && <Box component="span" aria-hidden sx={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: enCours ? 'text.primary' : 'text.secondary' }}>{sous}</Box>}
    </TableCell>
  )
}

// T2 : une case = le réel en gras précédé de sa pastille, le prévu en petit dessous ; au survol, l'écart. Sans réel, le
// prévu seul, en gris.
export function CaseReelPrevu({ reel, prevu, niveau, format, enCours, fort, charge }: {
  reel: number | null
  prevu: number | null
  niveau: NiveauEcart | null
  format: (v: number) => string
  enCours?: boolean
  fort?: boolean
  charge?: boolean
}) {
  const e = ecartReelPrevu(reel, prevu)
  const contenu = reel === null ? (
    <Box sx={{ color: 'text.secondary', position: 'relative' }}>{prevu === null ? '' : <>{format(prevu)}<Box component="span" sx={cache}> prévu</Box></>}</Box>
  ) : (
    <Box sx={{ display: 'grid', justifyItems: 'end', lineHeight: 1.3, position: 'relative' }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontWeight: fort ? 800 : 700 }}>
        <Pastille niveau={niveau} />{format(reel)}
      </Box>
      {prevu !== null && <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 400 }}><Box component="span" sx={cache}>prévu </Box>{format(prevu)}</Box>}
      {niveau && <Box component="span" sx={cache}>, {TEXTE_NIVEAU[niveau]}</Box>}
    </Box>
  )
  return (
    <TableCell align="right" className={enCours ? 'en-cours' : undefined}>
      {e ? (
        <Tooltip enterTouchDelay={0} title={`Écart au prévu : ${ecartMontant(e.montant)}${e.part === null ? '' : ` (${ecartTaux(e.part)})`}${charge ? ', une charge plus haute coûte' : ''}`}>
          <Box component="span" sx={{ display: 'inline-block' }}>{contenu}</Box>
        </Tooltip>
      ) : contenu}
    </TableCell>
  )
}

// Barres du réel dans les graphiques : mêmes couleurs que les pastilles (couleurs CSS, pas des clés du thème)
export const COULEUR_BARRE: Record<NiveauEcart, string> = { favorable: brand.vert, leger: brand.or, fort: 'var(--mui-palette-error-main)' }

// Légende des pastilles, le seuil étant celui de l'alerte CA (Paramètres réseau). Lot 38 (D5) : derrière une icône (i),
// comme toute l'aide, au lieu d'être répétée au-dessus de chaque tableau.
export function LegendePastilles({ seuil }: { seuil: number }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const pct = `${Math.round(seuil * 100)} %`
  return (
    <>
      <IconButton aria-label="Légende des pastilles" className="pas-a-l-impression" onClick={(e) => { e.stopPropagation(); setAncre(e.currentTarget) }}
        sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 }, color: 'text.secondary' }}>
        <InfoOutlined sx={{ fontSize: 18 }} />
      </IconButton>
      <Popover open={!!ancre} anchorEl={ancre} onClose={() => setAncre(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Légende des pastilles', sx: { p: 2, display: 'flex', flexDirection: 'column', gap: 1 } } }}>
        <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700 }}>Légende des pastilles</Typography>
        {([['favorable', 'au budget ou mieux'], ['leger', `jusqu’à ${pct} en dessous`], ['fort', `plus de ${pct} en dessous`]] as const).map(([n, t]) => (
          <Box key={n} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}><Pastille niveau={n} />{t}</Box>
        ))}
      </Popover>
    </>
  )
}

// Réel complété (03/11/2026) : un chiffre réparti depuis un quadrimestre s'écrit comme un réel ; un chiffre estimé, en
// italique précédé de « ≈ ». Le prévu en petit dessous, comme CaseReelPrevu.
export function CaseComplete({ chiffre, prevu, format, enCours, fort, charge }: {
  chiffre: { valeur: number; source: 'reel' | 'reparti' | 'estime' } | null
  prevu: number | null
  format: (v: number) => string
  enCours?: boolean
  fort?: boolean
  charge?: boolean
}) {
  if (!chiffre) return <TableCell align="right" className={enCours ? 'en-cours' : undefined}><Box sx={{ color: 'text.secondary' }}>{prevu === null ? '' : format(prevu)}</Box></TableCell>
  const estime = chiffre.source === 'estime'
  const e = ecartReelPrevu(chiffre.valeur, prevu)
  return (
    <TableCell align="right" className={enCours ? 'en-cours' : undefined} data-source={chiffre.source}>
      <Tooltip enterTouchDelay={0} title={`${estime ? 'Estimé' : chiffre.source === 'reparti' ? 'Réparti depuis le quadrimestre' : 'Réel'}${e ? `, écart au prévu : ${ecartMontant(e.montant)}${charge ? ', une charge plus haute coûte' : ''}` : ''}`}>
        <Box sx={{ display: 'inline-grid', justifyItems: 'end', lineHeight: 1.3, position: 'relative' }}>
          <Box component="span" sx={{ fontWeight: fort ? 800 : 700, ...(estime ? { fontStyle: 'italic', color: 'text.secondary' } : {}) }}>
            {estime && <Box component="span" aria-hidden sx={{ fontStyle: 'normal' }}>≈ </Box>}{format(chiffre.valeur)}
            {estime && <Box component="span" sx={cache}> estimé</Box>}
          </Box>
          {prevu !== null && <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 400 }}><Box component="span" sx={cache}>prévu </Box>{format(prevu)}</Box>}
        </Box>
      </Tooltip>
    </TableCell>
  )
}

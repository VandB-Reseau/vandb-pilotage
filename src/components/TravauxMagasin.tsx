import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { nombre } from '../import/caisse'
import { ecartMontant, enChiffres, milliers, MOIS } from '../lib/format'
import type { Travaux } from '../moteur/types'
import { ChampNombre } from './ChampNombre'
import { ChampTaux } from './ChampTaux'

export const sansTravaux = (): Travaux => ({ activite: Array(12).fill(1), gain: 0, investissement: 0, dureeAmortissement: 5 })

// Travaux de l'année : activité de chaque mois (0 % fermé), gain après réouverture, investissement amorti
export function TravauxMagasin({ travaux, onChange, lectureSeule, effetCA, dotation }: {
  travaux: Travaux | undefined
  onChange: (t: Travaux | undefined) => void
  lectureSeule: boolean
  effetCA: number   // CA de l'année avec les travaux moins sans
  dotation: number  // dotation de l'année due aux travaux
}) {
  // Montants gardés en texte pendant la frappe (« 60 000 ») ; le nombre part dans les ajustements
  const [textes, setTextes] = useState({ investissement: travaux?.investissement ? enChiffres(travaux.investissement) : '', duree: travaux ? enChiffres(travaux.dureeAmortissement) : '5' })
  if (!travaux) {
    if (lectureSeule) return null
    return (
      <Box>
        <Button variant="outlined" startIcon={<ConstructionOutlined />} onClick={() => onChange(sansTravaux())} sx={{ minHeight: 48 }}>Prévoir des travaux</Button>
      </Box>
    )
  }
  const montant = (cle: 'investissement' | 'duree', v: string) => {
    setTextes((t) => ({ ...t, [cle]: v }))
    const n = nombre(v)
    if (!Number.isNaN(n)) onChange({ ...travaux, [cle === 'duree' ? 'dureeAmortissement' : 'investissement']: n ?? 0 })
  }
  return (
    <Card component="section" aria-label="Travaux">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Travaux</Typography>
        <Typography variant="body2" color="text.secondary">CA de l’année : {ecartMontant(effetCA)} · Dotation : {milliers(dotation)}</Typography>
        {!lectureSeule && (
          <Button size="small" color="inherit" startIcon={<DeleteOutlined />} onClick={() => onChange(undefined)} sx={{ minHeight: 48 }}>Retirer les travaux</Button>
        )}
      </Box>
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label="Activité pendant les travaux"
          sx={{ '& td, & th': { px: 0.5, fontSize: '0.8125rem', whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, pr: 1.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell />
              {MOIS.map((m) => <TableCell key={m} align="right">{m}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Activité (%)</TableCell>
              {travaux.activite.map((a, i) => (
                <TableCell key={i} align="right" sx={{ py: 0.5 }}>
                  <ChampTaux
                    libelle={`Activité en ${MOIS[i]}`} valeur={a === 1 ? undefined : a} heritee={1} desactive={lectureSeule} largeur={62} sansUnite
                    onChange={(v) => onChange({ ...travaux, activite: travaux.activite.map((x, j) => (j === i ? Math.min(1, Math.max(0, v ?? 1)) : x)) })}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', px: 2.5, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Gain de CA après réouverture</Typography>
          <ChampTaux libelle="Gain de CA après réouverture" valeur={travaux.gain || undefined} heritee={0} desactive={lectureSeule} onChange={(v) => onChange({ ...travaux, gain: Math.max(0, v ?? 0) })} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Investissement HT</Typography>
          <ChampNombre libelle="Investissement HT" valeur={textes.investissement} desactive={lectureSeule} onChange={(v) => montant('investissement', v)} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Amorti sur</Typography>
          <ChampNombre libelle="Durée d’amortissement" valeur={textes.duree} unite="ans" largeur={110} desactive={lectureSeule} onChange={(v) => montant('duree', v)} />
        </Box>
      </Stack>
    </Card>
  )
}

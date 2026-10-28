import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { enChiffres, milliers, MOIS, taux } from '../lib/format'
import type { Budget } from '../moteur/types'
import { ChampTaux } from './ChampTaux'

export const totalPoids = (p: number[] | undefined) => (p ?? []).reduce((a, b) => a + b, 0)
// Une saisonnalité saisie doit faire 100 % (au millième près) pour être enregistrée
export const poidsValides = (p: number[] | undefined) => !p || Math.abs(totalPoids(p) - 1) < 0.0005

// Saisonnalité du magasin, mois par mois dans la cellule ; vide : celle du CA de référence
export function SaisonnaliteMagasin({ budget, poids, onChange, lectureSeule }: {
  budget: Budget
  poids: number[] | undefined
  onChange: (p: number[] | undefined) => void
  lectureSeule: boolean
}) {
  const total = totalPoids(poids)
  return (
    <Card component="section" aria-label="Saisonnalité">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Saisonnalité</Typography>
        <Typography variant="body2" color={poids ? 'warning.dark' : 'text.secondary'} sx={{ fontWeight: poids ? 700 : 400 }}>
          {poids ? 'Propre au magasin' : 'CA de référence'}
        </Typography>
        {poids && !lectureSeule && (
          <Button size="small" startIcon={<RestartAltOutlined />} onClick={() => onChange(undefined)} sx={{ minHeight: 48 }}>Reprendre le CA de référence</Button>
        )}
      </Box>
      {!poidsValides(poids) && (
        <Alert severity="warning" sx={{ mx: 2.5, mb: 1 }}>Le total des mois fait {taux(total)} : il doit faire 100 % pour enregistrer.</Alert>
      )}
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label="Saisonnalité du budget"
          sx={{ '& td, & th': { px: 0.5, fontSize: '0.8125rem', whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, pr: 1.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell />
              {MOIS.map((m) => <TableCell key={m} align="right">{m}</TableCell>)}
              <TableCell align="right" sx={{ pr: '20px !important' }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Part (%)</TableCell>
              {budget.poids.map((w, i) => (
                <TableCell key={i} align="right" sx={{ py: 0.5 }}>
                  <ChampTaux
                    libelle={`Part du CA en ${MOIS[i]}`} valeur={poids?.[i]} heritee={w} desactive={lectureSeule} largeur={62} sansUnite
                    onChange={(v) => {
                      const p = [...(poids ?? budget.poids)]
                      p[i] = v ?? budget.poids[i]
                      onChange(p)
                    }}
                  />
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700, pr: '20px !important', color: poidsValides(poids) ? undefined : 'error.main' }}>{taux(poids ? total : 1)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>CA du mois</TableCell>
              {budget.mois.map((m, i) => <TableCell key={i} align="right" sx={{ color: 'text.secondary', pr: '12px !important' }}>{enChiffres(Math.round(m.ca))}</TableCell>)}
              <TableCell align="right" sx={{ fontWeight: 700, pr: '20px !important' }}>{milliers(budget.ca)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

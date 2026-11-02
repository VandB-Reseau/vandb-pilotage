import { useState } from 'react'
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
import { ecartMilliers, ecartTaux, milliers } from '../lib/format'
import { cheminsVersEbe } from '../moteur/objectifEbe'
import type { Budget } from '../moteur/types'
import { Aide } from './Aide'
import { ChampMontant } from './ChampMontant'
import { styleTableau } from '../theme/tableau'

// Lot 41, proposition 4 : un EBE visé, et ce qu'il faudrait pour l'atteindre, un levier à la fois. « Appliquer » reporte
// la valeur dans les hypothèses du magasin (à enregistrer ensuite, comme toute saisie).
export function ObjectifEbe({ budget, ebeAvec, onAppliquer, lectureSeule }: {
  budget: Budget
  ebeAvec: (cle: string, x: number) => number
  onAppliquer: (cle: string, x: number) => void
  lectureSeule: boolean
}) {
  const [cible, setCible] = useState<number | undefined>(undefined)
  const chemins = cible === undefined ? null : cheminsVersEbe(budget, cible, ebeAvec)
  return (
    <Card component="section" aria-label="Objectif d’EBE" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 200 }}>
          <Typography variant="h2">Objectif d’EBE</Typography>
          <Aide sujet="objectifEbe" />
        </Box>
        <ChampMontant libelle="EBE visé" valeur={cible ?? 0} onChange={(v) => setCible(v || undefined)} />
        <Typography variant="body2" color="text.secondary">
          {chemins ? `Aujourd’hui ${milliers(budget.ebe)} : ${chemins.manque >= 0 ? 'il manque' : 'au-dessus de'} ${milliers(Math.abs(chemins.manque))}` : `EBE du budget : ${milliers(budget.ebe)}`}
        </Typography>
      </Box>
      {chemins && Math.abs(chemins.manque) >= 100 && (
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small" aria-label="Leviers pour atteindre l’EBE visé" sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell>Levier, seul</TableCell>
                <TableCell align="right">Aujourd’hui</TableCell>
                <TableCell align="right">Pour l’EBE visé</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {chemins.leviers.map((l) => (
                <TableRow key={l.cle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell align="right">{ecartTaux(l.actuelle)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{l.valeur === null ? 'Hors de portée' : ecartTaux(l.valeur)}</TableCell>
                  <TableCell align="right">
                    {!lectureSeule && l.valeur !== null && (
                      <Button onClick={() => onAppliquer(l.cle, l.valeur!)} sx={{ minHeight: 48 }} aria-label={`Appliquer : ${l.libelle} ${ecartTaux(l.valeur)}`}>Appliquer</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Masse salariale</TableCell>
                <TableCell align="right">{milliers(budget.personnel)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{chemins.masseSalariale === null ? 'Hors de portée' : `${milliers(chemins.masseSalariale)} (${ecartMilliers(chemins.masseSalariale - budget.personnel)})`}</TableCell>
                <TableCell align="right"><Typography variant="body2" color="text.secondary">Dans l’équipe</Typography></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

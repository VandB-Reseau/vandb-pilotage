import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import { texteSujet } from './FicheVisite'
import { lienMagasin, milliers } from '../lib/format'
import { parCoach, type LigneSemaine } from '../moteur/semaine'

const PREMIERS = 10
const rouge = (v: number) => (v > 0 ? { color: 'error.main', fontWeight: 700 } : undefined)

// « Ma semaine » (lot 29) : où aller en premier, magasin par magasin ; par Coach pour le RR et le Directeur
export function MaSemaine({ lignes, avecCoachs, etat }: { lignes: LigneSemaine[]; avecCoachs: boolean; etat?: object }) {
  const [tout, setTout] = useState(false)
  if (!lignes.length) return null
  const vues = tout ? lignes : lignes.slice(0, PREMIERS)
  const coachs = avecCoachs ? parCoach(lignes) : []
  const tableau = { '& td, & th': { whiteSpace: 'nowrap', px: 1.25 }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }
  return (
    <Card component="section" aria-label="Ma semaine" sx={{ mb: 4 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2">Ma semaine <Aide sujet="semaine" /></Typography>
      </Box>
      <TableContainer>
        <Table size="small" aria-label="Magasins par marge en jeu" sx={tableau}>
          <TableHead>
            <TableRow>
              <TableCell>Magasin</TableCell>
              {avecCoachs && <TableCell>Coach</TableCell>}
              <TableCell align="right">Marge en jeu</TableCell>
              <TableCell>Premier sujet</TableCell>
              <TableCell align="right">Alertes</TableCell>
              <TableCell align="right">Actions en retard</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vues.map((l) => (
              <TableRow key={l.magasin}>
                <TableCell><Link component={RouterLink} to={lienMagasin(l.magasin)} state={etat} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{l.magasin}</Link></TableCell>
                {avecCoachs && <TableCell>{l.coach}</TableCell>}
                <TableCell align="right" sx={{ fontWeight: 700 }}>{l.enJeu > 0 ? milliers(l.enJeu) : '–'}</TableCell>
                <TableCell>{l.sujet ? texteSujet(l.sujet).constat : 'Rien ne recule'}</TableCell>
                <TableCell align="right" sx={rouge(l.alertes)}>{l.alertes}</TableCell>
                <TableCell align="right" sx={rouge(l.actionsEnRetard)}>{l.actionsEnRetard}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {lignes.length > PREMIERS && (
        <Box sx={{ px: 1.5, py: 0.5 }}>
          <Button onClick={() => setTout((x) => !x)} aria-expanded={tout} sx={{ minHeight: 48 }}>{tout ? 'Voir moins' : `Voir les ${lignes.length} magasins`}</Button>
        </Box>
      )}
      {coachs.length > 1 && (
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small" aria-label="Marge en jeu par Coach" sx={tableau}>
            <TableHead>
              <TableRow>
                <TableCell>Par Coach</TableCell>
                <TableCell align="right">Magasins</TableCell>
                <TableCell align="right">À suivre</TableCell>
                <TableCell align="right">Marge en jeu</TableCell>
                <TableCell align="right">Alertes</TableCell>
                <TableCell align="right">Actions en retard</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coachs.map((c) => (
                <TableRow key={c.coach}>
                  <TableCell sx={{ fontWeight: 600 }}>{c.coach || 'Sans Coach'}</TableCell>
                  <TableCell align="right">{c.magasins}</TableCell>
                  <TableCell align="right">{c.aSuivre}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{milliers(c.enJeu)}</TableCell>
                  <TableCell align="right" sx={rouge(c.alertes)}>{c.alertes}</TableCell>
                  <TableCell align="right" sx={rouge(c.actionsEnRetard)}>{c.actionsEnRetard}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

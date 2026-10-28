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
import { Aide } from './Aide'
import { chargerComparaison } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, taux } from '../lib/format'
import { famillesFaceAuReseau, MIN_MAGASINS_FAMILLE } from '../moteur/familles'
import { universLibelle } from '../moteur/types'

const PREMIERES = 8

// Familles et corners face au réseau (lot 29) : poids et marge de chaque famille, médianes du réseau, potentiel de marge
export function FamillesReseau({ magasin, directeur }: { magasin: string; directeur: boolean }) {
  const { donnees } = useChargement(() => chargerComparaison(), [])
  const [toutes, setToutes] = useState(false)
  if (!donnees) return null
  const moi = donnees.familles.find((x) => x.magasin === magasin)
  if (!moi || donnees.familles.length < MIN_MAGASINS_FAMILLE) return null
  const lignes = famillesFaceAuReseau(moi.familles, donnees.familles.map((x) => x.familles))
  if (!lignes.length) return null
  const vues = toutes ? lignes : lignes.slice(0, PREMIERES)
  const total = lignes.reduce((a, l) => a + (l.potentiel ?? 0), 0)
  const v = (x: number | null) => (x === null ? '–' : taux(x))
  return (
    <Card component="section" aria-label="Familles face au réseau" sx={{ mt: 3 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2">Familles face au réseau <Aide sujet="familles" /></Typography>
        <Typography color="text.secondary">
          Réalisé {donnees.annee} · {directeur ? 'médiane du réseau' : 'médiane de tes magasins'}{total > 0 ? ` · potentiel de ${milliers(total)} de marge` : ''}
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small" aria-label={`Familles de ${magasin} face au réseau`} sx={{ '& td, & th': { whiteSpace: 'nowrap', px: 1.25 }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Famille</TableCell>
              <TableCell align="right">Poids dans l’univers</TableCell>
              <TableCell align="right">Médiane</TableCell>
              <TableCell align="right">Marge</TableCell>
              <TableCell align="right">Médiane</TableCell>
              <TableCell align="right">Potentiel</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vues.map((l) => (
              <TableRow key={`${l.univers}-${l.famille}`}>
                <TableCell>{l.famille} <Typography component="span" color="text.secondary">· {universLibelle[l.univers]}</Typography></TableCell>
                <TableCell align="right" sx={l.medianePoids !== null && l.poids < l.medianePoids ? { color: 'error.main', fontWeight: 600 } : undefined}>{taux(l.poids)}</TableCell>
                <TableCell align="right">{v(l.medianePoids)}</TableCell>
                <TableCell align="right">{v(l.tauxMarge)}</TableCell>
                <TableCell align="right">{v(l.medianeTaux)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: l.potentiel ? 700 : 400 }}>{l.potentiel ? `+${milliers(l.potentiel)}` : '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {lignes.length > PREMIERES && (
        <Box sx={{ px: 1.5, py: 0.5 }}>
          <Button onClick={() => setToutes((x) => !x)} aria-expanded={toutes} sx={{ minHeight: 48 }}>{toutes ? 'Voir moins' : `Voir les ${lignes.length} familles`}</Button>
        </Box>
      )}
    </Card>
  )
}

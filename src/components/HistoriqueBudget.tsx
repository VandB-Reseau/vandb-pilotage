import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { Panne } from './Panne'
import { roleLibelle, type Role } from '../auth/roles'
import {
  chargerEchanges, hypothesesDe, statutLibelle, type DonneesBudgets, type LigneMagasin, type VersionBudget,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartMontant, milliers } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import type { ParametresReseau } from '../moteur/types'

const VERSIONS_VISIBLES = 8
const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const qui = (role: Role | null, nom: string | null) => [role ? roleLibelle[role] : null, nom].filter(Boolean).join(' · ') || 'Compte retiré'

// Chiffres clés d'une version, recalculés avec les cibles d'aujourd'hui
function chiffres(v: VersionBudget, ligne: LigneMagasin, d: DonneesBudgets, parametres: ParametresReseau) {
  if (!v.base) return null
  const h = hypothesesDe({ ...ligne, base: v.base, ajustements: v.ajustements, statut: 'en_discussion', figees: null }, d, v.ajustements)
  return h ? calculerBudget(h.hypotheses, parametres) : null
}

// Historique des versions du budget (les messages sont devenus des commentaires, Joseph 03/11/2026)
export function HistoriqueBudget({ ligne, d, annee, parametres }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  parametres: ParametresReseau
}) {
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerEchanges(ligne.magasin, annee), [ligne.magasin, annee, ligne.majLe])
  const [toutes, setToutes] = useState(false)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={160} />
  if (erreur || !donnees) return <Panne quoi="L’historique du budget" recharger={recharger} />

  const versions = donnees.versions.map((v) => ({ v, b: chiffres(v, ligne, d, parametres) }))
  const visibles = toutes ? versions : versions.slice(0, VERSIONS_VISIBLES)

  return (
    <>
      {versions.length > 0 && (
        <Card component="section" aria-label="Historique du budget">
          <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Historique du budget {annee}</Typography>
          <TableContainer>
            <Table size="small" aria-label={`Versions du budget ${annee}`} sx={{ '& td, & th': { whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Par</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="right">CA HT</TableCell>
                  <TableCell align="right">EBE</TableCell>
                  <TableCell align="right">Écart d’EBE</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibles.map(({ v, b }, i) => {
                  const avant = versions[i + 1]?.b
                  const ecart = b && avant ? b.ebe - avant.ebe : null
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{quand(v.creeLe)}</TableCell>
                      <TableCell>{qui(v.auteurRole, v.auteurNom)}</TableCell>
                      <TableCell>{statutLibelle[v.statut] ?? v.statut}</TableCell>
                      <TableCell align="right">{b ? milliers(b.ca) : '–'}</TableCell>
                      <TableCell align="right">{b ? milliers(b.ebe) : '–'}</TableCell>
                      <TableCell align="right" sx={{ color: ecart === null || Math.abs(ecart) < 0.5 ? 'text.disabled' : ecart < 0 ? 'error.main' : 'success.main' }}>
                        {ecart === null || Math.abs(ecart) < 0.5 ? '–' : ecartMontant(ecart)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {versions.length > VERSIONS_VISIBLES && (
            <Box sx={{ px: 1.5, py: 1 }}>
              <Button onClick={() => setToutes((t) => !t)} sx={{ minHeight: 48 }}>{toutes ? 'Voir les dernières versions' : `Voir les ${versions.length} versions`}</Button>
            </Box>
          )}
        </Card>
      )}
    </>
  )
}

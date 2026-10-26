import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useAuth } from '../auth/AuthContext'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { anneeBudget, chargerMagasins, chargerParametres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { dateHeure, lienMagasin, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'

export function Magasins() {
  const { profil } = useAuth()
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    async () => {
      const [lignes, { parametres }] = await Promise.all([chargerMagasins(annee), chargerParametres(annee)])
      return lignes.map((l) => ({ ...l, budget: l.hypotheses ? calculerBudget(l.hypotheses, parametres) : null }))
    }, [annee])

  const compte = useMemo(() => {
    const l = donnees ?? []
    return { valides: l.filter((m) => m.statut === 'valide').length, discussion: l.filter((m) => m.statut === 'en_discussion').length, proposes: l.filter((m) => m.statut === 'propose').length, sans: l.filter((m) => !m.statut).length }
  }, [donnees])

  const entete = (
    <>
      <Typography variant="h1">Magasins</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Budgets {annee}</Typography>
    </>
  )
  if (profil?.role === 'aucun') {
    return <Box>{entete}<EtatVide titre="Ton accès n’est pas encore ouvert" texte="Le Directeur de réseau ouvre les accès depuis l’app du réseau. Dès que c’est fait, tes magasins apparaissent ici." /></Box>
  }

  return (
    <Box>
      {entete}

      {erreur && <Panne quoi="Les budgets" recharger={recharger} />}
      {chargement && <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>}

      {donnees && donnees.length === 0 && (
        <EtatVide titre="Aucun magasin rattaché à ton compte" texte="Les magasins de chaque compte sont tenus dans l’app du réseau. Demande au Directeur de réseau de vérifier ton périmètre." />
      )}

      {donnees && donnees.length > 0 && (
        <>
          <Stack direction="row" spacing={3} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }} aria-label="Avancement des budgets">
            <Typography variant="body2"><b>{compte.valides}</b> validés</Typography>
            <Typography variant="body2"><b>{compte.discussion}</b> en discussion</Typography>
            <Typography variant="body2"><b>{compte.proposes}</b> proposés par le siège</Typography>
            <Typography variant="body2"><b>{compte.sans}</b> sans budget</Typography>
          </Stack>

          {telephone ? (
            <Stack spacing={1.5}>
              {donnees.map((m) => (
                <Card key={m.magasin}>
                  <CardActionArea component={RouterLink} to={lienMagasin(m.magasin)} sx={{ p: 2, minHeight: 56 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h5" component="h2">{m.magasin}</Typography>
                      <PastilleStatut statut={m.statut} />
                    </Box>
                    {m.budget && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        CA {milliers(m.budget.ca)} · EBE {milliers(m.budget.ebe)} ({taux(m.budget.ratios.ebeSurCA)})
                      </Typography>
                    )}
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          ) : (
            <Card>
              <TableContainer>
                <Table className="colonne-fixe" aria-label={`Budgets ${annee} par magasin`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Magasin</TableCell>
                      <TableCell>Budget {annee}</TableCell>
                      <TableCell align="right">CA HT</TableCell>
                      <TableCell align="right">Marge</TableCell>
                      <TableCell align="right">Masse salariale / marge</TableCell>
                      <TableCell align="right">EBE</TableCell>
                      <TableCell align="right">EBE / CA</TableCell>
                      <TableCell>Mis à jour</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {donnees.map((m) => (
                      <TableRow key={m.magasin} hover>
                        <TableCell><Link component={RouterLink} to={lienMagasin(m.magasin)} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link></TableCell>
                        <TableCell><PastilleStatut statut={m.statut} /></TableCell>
                        <TableCell align="right">{m.budget ? milliers(m.budget.ca) : ''}</TableCell>
                        <TableCell align="right">{m.budget ? taux(m.budget.tauxMarge) : ''}</TableCell>
                        <TableCell align="right">{m.budget ? taux(m.budget.ratios.personnelSurMarge) : ''}</TableCell>
                        <TableCell align="right">{m.budget ? milliers(m.budget.ebe) : ''}</TableCell>
                        <TableCell align="right">{m.budget ? taux(m.budget.ratios.ebeSurCA) : ''}</TableCell>
                        <TableCell>{m.majLe ? dateHeure(m.majLe) : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}

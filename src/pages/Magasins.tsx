import { useMemo } from 'react'
import { Navigate, Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
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
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { useAuth } from '../auth/AuthContext'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { anneeBudget, chargerBudgets, chargerParametres, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { correspond, filtrerMagasins, FILTRES, type Filtre } from '../lib/aFaire'
import { dateHeure, lienMagasin, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'

export function Magasins() {
  const { profil } = useAuth()
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    async () => {
      const [d, { parametres }] = await Promise.all([chargerBudgets(annee), chargerParametres(annee)])
      const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
      return {
        groupes: d.groupes,
        magasins: d.magasins.map((l) => {
          const h = hypothesesDe(l, d)
          return {
            ...l, groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '', budget: h ? calculerBudget(h.hypotheses, parametres) : null,
            aEquipe: !!d.equipes[l.magasin]?.length, aFrais: !!d.frais[l.magasin]?.length,
          }
        }),
      }
    }, [annee])

  // Filtres gardés dans l'adresse : le retour depuis une fiche les retrouve
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const filtre = (FILTRES.some((f) => f.cle === params.get('filtre')) ? params.get('filtre') : 'tous') as Filtre
  const recherche = params.get('q') ?? ''
  const groupe = params.get('groupe') ? Number(params.get('groupe')) : null
  const changer = (cle: string, valeur: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (valeur) n.set(cle, valeur); else n.delete(cle); return n }, { replace: true })

  const tous = donnees?.magasins ?? []
  const visibles = useMemo(() => filtrerMagasins(tous, filtre, recherche, groupe), [tous, filtre, recherche, groupe])
  const etat = { liste: visibles.map((m) => m.magasin), retour: params.toString() }

  const entete = (
    <>
      <Typography variant="h1">Magasins</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Budgets {annee}</Typography>
    </>
  )
  // Un franchisé qui n'a qu'un magasin arrive directement sur sa fiche
  if (profil?.role === 'franchise' && tous.length === 1) return <Navigate to={lienMagasin(tous[0].magasin)} replace />
  if (profil?.role === 'aucun') {
    return <Box>{entete}<EtatVide titre="Ton accès n’est pas encore ouvert" texte="Le Directeur de réseau ouvre les accès depuis l’app du réseau. Dès que c’est fait, tes magasins apparaissent ici." /></Box>
  }

  return (
    <Box>
      {entete}

      {erreur && <Panne quoi="Les budgets" recharger={recharger} />}
      {chargement && <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={56} />)}</Stack>}

      {donnees && tous.length === 0 && (
        <EtatVide titre="Aucun magasin rattaché à ton compte" texte="Les magasins de chaque compte sont tenus dans l’app du réseau. Demande au Directeur de réseau de vérifier ton périmètre." />
      )}

      {donnees && tous.length > 0 && (
        <>
          {(tous.length > 5 || donnees.groupes.length > 0) && (
            <Stack direction="row" spacing={2} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
              {tous.length > 5 && (
                <TextField
                  size="small" value={recherche} onChange={(e) => changer('q', e.target.value)} placeholder="Rechercher un magasin"
                  slotProps={{ htmlInput: { 'aria-label': 'Rechercher un magasin' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
                  sx={{ width: { xs: '100%', sm: 320 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
                />
              )}
              {donnees.groupes.length > 0 && (
                <TextField
                  select size="small" label="Groupe" value={groupe ?? ''} onChange={(e) => changer('groupe', e.target.value || null)}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                  sx={{ width: { xs: '100%', sm: 240 }, '& .MuiSelect-select': { minHeight: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', py: 0 }, '& .MuiSelect-nativeInput': { height: 48 } }}
                >
                  <MenuItem value="" sx={{ minHeight: 48 }}>Tous les groupes</MenuItem>
                  {donnees.groupes.map((g) => <MenuItem key={g.id} value={g.id} sx={{ minHeight: 48 }}>{g.nom}</MenuItem>)}
                </TextField>
              )}
            </Stack>
          )}

          <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }} role="group" aria-label="Filtres">
            {FILTRES.map((f) => {
              const n = f.cle === 'tous' ? tous.length : tous.filter((m) => correspond(m, f.cle)).length
              if (n === 0 && f.cle !== filtre) return null
              const choisi = f.cle === filtre
              return (
                <Chip
                  key={f.cle} label={`${f.libelle} · ${n}`} clickable aria-pressed={choisi}
                  color={choisi ? 'primary' : 'default'} variant={choisi ? 'filled' : 'outlined'}
                  onClick={() => changer('filtre', f.cle === 'tous' ? null : f.cle)}
                  sx={{ height: { xs: 48, md: 36 }, fontSize: '0.875rem' }}
                />
              )
            })}
          </Stack>

          {visibles.length === 0 && (
            <EtatVide titre="Aucun magasin ne correspond" texte="Change de filtre ou de recherche pour retrouver tes magasins." />
          )}

          {telephone ? (
            <Stack spacing={1.5}>
              {visibles.map((m) => (
                <Card key={m.magasin}>
                  <CardActionArea component={RouterLink} to={lienMagasin(m.magasin)} state={etat} sx={{ p: 2, minHeight: 56 }}>
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
          ) : visibles.length > 0 && (
            <Card>
              <TableContainer>
                <Table className="colonne-fixe" aria-label={`Budgets ${annee} par magasin`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Magasin</TableCell>
                      <TableCell>Groupe</TableCell>
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
                    {visibles.map((m) => (
                      <TableRow key={m.magasin} hover onClick={() => navigate(lienMagasin(m.magasin), { state: etat })} sx={{ cursor: 'pointer' }}>
                        <TableCell><Link component={RouterLink} to={lienMagasin(m.magasin)} state={etat} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link></TableCell>
                        <TableCell>{m.groupe}</TableCell>
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

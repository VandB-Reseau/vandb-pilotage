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
import TableSortLabel from '@mui/material/TableSortLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import FilterListOutlined from '@mui/icons-material/FilterListOutlined'
import { useAuth } from '../auth/AuthContext'
import { AlertesMagasins, typeAlerteLibelle } from '../components/AlertesMagasins'
import { ATraiter } from '../components/ATraiter'
import { CampagneBudgets } from '../components/CampagneBudgets'
import { estDirecteur, estEquipe } from '../auth/roles'
import { EtatVide } from '../components/EtatVide'
import { Indicateur } from '../components/Indicateur'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { anneeBudget, chargerActions, chargerAlertes, chargerBudgets, chargerParametres, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { aTraiter, correspond, filtrerMagasins, FILTRES, type Filtre } from '../lib/aFaire'
import { dateHeure, lienMagasin, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { tresorerieBudget } from '../moteur/tresorerie'
import { syntheseBudgets, totalBudgets } from '../moteur/sante'
import type { Alerte } from '../moteur/alertes'
import { campagneDe } from '../moteur/campagne'

// Liste des magasins (lot 27) : une ligne par magasin, colonnes triables, alertes et EBE / CA lisibles d'un coup d'œil
const ENTETES = [
  { cle: 'magasin', libelle: 'Magasin' },
  { cle: 'groupe', libelle: 'Groupe' },
  { cle: 'statut', libelle: 'Budget' },
  { cle: 'alertes', libelle: 'Alertes' },
  { cle: 'ca', libelle: 'CA HT', droite: true },
  { cle: 'marge', libelle: 'Marge', droite: true },
  { cle: 'personnel', libelle: 'Masse salariale / marge', droite: true },
  { cle: 'ebe', libelle: 'EBE', droite: true },
  { cle: 'ebeSurCA', libelle: 'EBE / CA', droite: true },
  { cle: 'pointBas', libelle: 'Point bas de trésorerie', droite: true },
  { cle: 'majLe', libelle: 'Mis à jour' },
] as const
type Tri = (typeof ENTETES)[number]['cle']
const COLONNES_TRI = ENTETES.map((c) => c.cle)
// Texte : A à Z d'abord ; chiffres et alertes : le plus grand d'abord ; masse salariale : la plus faible d'abord
const SENS_DEFAUT: Record<Tri, 'asc' | 'desc'> = {
  magasin: 'asc', groupe: 'asc', statut: 'asc', alertes: 'desc', ca: 'desc', marge: 'desc', personnel: 'asc', ebe: 'desc', ebeSurCA: 'desc', pointBas: 'asc', majLe: 'desc',
}

// « 2 alertes · CA sous le budget » : le nombre et la plus grave
const texteAlertes = (l: Alerte[]) => `${l.length === 1 ? '1 alerte' : `${l.length} alertes`} · ${typeAlerteLibelle[l[0].type]}`

// EBE / CA avec une barre proportionnelle au plus fort de la liste ; rouge sous zéro
function RatioEbe({ valeur, max }: { valeur: number; max: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
      {taux(valeur)}
      <Box component="span" aria-hidden sx={{ width: 48, height: 8, borderRadius: 1, bgcolor: 'grey.200', display: 'inline-block', overflow: 'hidden' }}>
        <Box component="span" sx={{ display: 'block', height: '100%', width: `${Math.min(100, Math.abs(valeur) / max * 100)}%`, bgcolor: valeur < 0 ? 'error.main' : 'success.main' }} />
      </Box>
    </Box>
  )
}

export function Magasins() {
  const { profil } = useAuth()
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    async () => {
      // Plan d'action : seulement pour « À traiter » ; sans lui, la liste s'affiche quand même
      const [d, { parametres }, alertes, actions] = await Promise.all([
        chargerBudgets(annee), chargerParametres(annee), chargerAlertes(), estEquipe(profil) ? chargerActions().catch(() => []) : Promise.resolve([]),
      ])
      const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
      return {
        groupes: d.groupes, alertes, actions, campagne: campagneDe(parametres, annee),
        magasins: d.magasins.map((l) => {
          const h = hypothesesDe(l, d)
          const budget = h ? calculerBudget(h.hypotheses, parametres) : null
          return {
            ...l, groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '', budget,
            pointBas: budget && h ? tresorerieBudget(budget, h.hypotheses, parametres, parametres.tresorerie, l.ajustements?.tresorerieDepart ?? 0).pointBas.montant : null,
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
  // Alertes par magasin : déjà triées de la plus grave à la moins grave
  const alertesDe = useMemo(() => {
    const m = new Map<string, Alerte[]>()
    for (const a of donnees?.alertes ?? []) m.set(a.magasin, [...(m.get(a.magasin) ?? []), a])
    return m
  }, [donnees])
  const tri = (COLONNES_TRI as readonly string[]).includes(params.get('tri') ?? '') ? params.get('tri') as Tri : null
  // Sans tri choisi, l'ordre du réseau (celui des fiches précédente et suivante)
  const sens = params.get('sens') === 'desc' ? 'desc' : params.get('sens') === 'asc' ? 'asc' : tri ? SENS_DEFAUT[tri] : 'asc'
  const visibles = useMemo(() => {
    const l = filtrerMagasins(tous, filtre, recherche, groupe)
    if (!tri) return l
    const valeur = (m: (typeof l)[number]): number | string | null => {
      switch (tri) {
        case 'magasin': return m.magasin
        case 'groupe': return m.groupe || null
        case 'statut': return m.statut ?? null
        case 'alertes': return alertesDe.get(m.magasin)?.length ?? 0
        case 'pointBas': return m.pointBas
        case 'majLe': return m.majLe
        case 'ca': return m.budget?.ca ?? null
        case 'marge': return m.budget?.tauxMarge ?? null
        case 'personnel': return m.budget?.ratios.personnelSurMarge ?? null
        case 'ebe': return m.budget?.ebe ?? null
        case 'ebeSurCA': return m.budget?.ratios.ebeSurCA ?? null
      }
    }
    // Valeur absente toujours en bas, quel que soit le sens
    return [...l].sort((a, b) => {
      const x = valeur(a), y = valeur(b)
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'fr') : x - (y as number)
      return (sens === 'asc' ? c : -c) || a.magasin.localeCompare(b.magasin, 'fr')
    })
  }, [tous, filtre, recherche, groupe, tri, sens, alertesDe])
  const trier = (cle: Tri) => setParams((p) => {
    const n = new URLSearchParams(p)
    n.set('tri', cle)
    n.set('sens', tri === cle ? (sens === 'asc' ? 'desc' : 'asc') : SENS_DEFAUT[cle])
    return n
  }, { replace: true })
  const avecGroupe = tous.some((m) => m.groupe)
  const total = totalBudgets(visibles.flatMap((m) => (m.budget ? [m.budget] : [])))
  const ebeMax = Math.max(0.01, ...visibles.map((m) => Math.abs(m.budget?.ratios.ebeSurCA ?? 0)))
  const synthese = tous.length > 1 ? syntheseBudgets(tous) : null
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
          {estEquipe(profil) && (
            <Box sx={{ mb: 3 }}>
              <ATraiter
                items={aTraiter(tous, donnees.alertes, donnees.actions, estDirecteur(profil), new Date().toISOString().slice(0, 10))}
                annee={annee} directeur={estDirecteur(profil)} etat={{ liste: tous.map((m) => m.magasin) }}
                filtrer={(f) => { changer('filtre', f === 'tous' ? null : f); document.querySelector('[aria-label="Filtres"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
              />
            </Box>
          )}
          {estEquipe(profil) && (
            <Box sx={{ mb: 3 }}>
              <CampagneBudgets annee={annee} campagne={donnees.campagne} magasins={tous} aujourdhui={new Date().toISOString().slice(0, 10)} />
            </Box>
          )}
          {synthese && (
            <Box component="section" aria-label={`Budgets ${annee} en chiffres`} sx={{ display: 'grid', gap: 2, mb: 4, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
              <Indicateur libelle={`Budgets ${annee} validés`} valeur={`${synthese.valides} sur ${synthese.magasins}`} detail={`${synthese.avecBudget} magasin${synthese.avecBudget > 1 ? 's' : ''} avec un budget`} />
              <Indicateur libelle="CA HT budgété" valeur={milliers(synthese.ca)} detail={`Somme des ${synthese.avecBudget} budgets`} />
              <Indicateur libelle="EBE budgété" valeur={milliers(synthese.ebe)} detail={`${taux(synthese.ebeSurCA)} du CA`} />
              <Indicateur libelle="Fiches à compléter" valeur={String(synthese.aCompleter)} detail="Équipe ou frais à renseigner" />
            </Box>
          )}
          {/* Lot 30 (E3) : pour le Directeur, le RR et le Coach, les alertes se lisent dans Ma semaine (vue Réseau) */}
          {!estEquipe(profil) && <Box sx={{ mb: 4 }}><AlertesMagasins alertes={donnees.alertes} etat={{ liste: tous.map((m) => m.magasin) }} /></Box>}
          {(tous.length > 5 || donnees.groupes.length > 0) && (
            <Stack direction="row" spacing={2} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
              {tous.length > 5 && (
                <TextField
                  size="small" value={recherche} onChange={(e) => changer('q', e.target.value)} placeholder="Filtrer la liste"
                  slotProps={{ htmlInput: { 'aria-label': 'Filtrer la liste des magasins' }, input: { startAdornment: <InputAdornment position="start"><FilterListOutlined /></InputAdornment> } }}
                  sx={{ width: { xs: '100%', sm: 320 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
                />
              )}
              {donnees.groupes.length > 0 && (
                <TextField
                  select size="small" label="Groupe" value={groupe ?? ''} onChange={(e) => changer('groupe', e.target.value || null)}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                  sx={{ width: { xs: '100%', sm: 240 }, '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }}
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
                    {!!alertesDe.get(m.magasin)?.length && (
                      <Typography variant="body2" sx={{ mt: 0.5, color: 'error.main', fontWeight: 600 }}>{texteAlertes(alertesDe.get(m.magasin)!)}</Typography>
                    )}
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          ) : visibles.length > 0 && (
            <Card>
              <TableContainer>
                <Table className="colonne-fixe" aria-label={`Budgets ${annee} par magasin`} sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
                  <TableHead>
                    <TableRow>
                      {ENTETES.filter((c) => avecGroupe || c.cle !== 'groupe').map((c) => (
                        <TableCell key={c.cle} align={'droite' in c ? 'right' : 'left'} sortDirection={tri === c.cle ? sens : false} sx={{ verticalAlign: 'bottom' }}>
                          <TableSortLabel active={tri === c.cle} direction={tri === c.cle ? sens : SENS_DEFAUT[c.cle]} onClick={() => trier(c.cle)} sx={{ minHeight: 36 }}>
                            {c.cle === 'statut' ? `Budget ${annee}` : c.libelle}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {total.magasins > 1 && (
                      <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 700 } }}>
                        <TableCell>Total de la sélection</TableCell>
                        {avecGroupe && <TableCell />}
                        <TableCell sx={{ fontWeight: '400 !important', color: 'text.secondary' }}>{total.magasins} budgets</TableCell>
                        <TableCell />
                        <TableCell align="right">{milliers(total.ca)}</TableCell>
                        <TableCell align="right">{taux(total.tauxMarge)}</TableCell>
                        <TableCell align="right">{taux(total.personnelSurMarge)}</TableCell>
                        <TableCell align="right">{milliers(total.ebe)}</TableCell>
                        <TableCell align="right"><RatioEbe valeur={total.ebeSurCA} max={ebeMax} /></TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    )}
                    {visibles.map((m) => {
                      const alertes = alertesDe.get(m.magasin) ?? []
                      return (
                        <TableRow key={m.magasin} hover onClick={() => navigate(lienMagasin(m.magasin), { state: etat })} sx={{ cursor: 'pointer' }}>
                          <TableCell><Link component={RouterLink} to={lienMagasin(m.magasin)} state={etat} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link></TableCell>
                          {avecGroupe && <TableCell>{m.groupe}</TableCell>}
                          <TableCell><PastilleStatut statut={m.statut} /></TableCell>
                          <TableCell sx={alertes.length ? { color: 'error.main', fontWeight: 600 } : { color: 'text.secondary' }}>{alertes.length ? texteAlertes(alertes) : 'Aucune'}</TableCell>
                          <TableCell align="right">{m.budget ? milliers(m.budget.ca) : ''}</TableCell>
                          <TableCell align="right">{m.budget ? taux(m.budget.tauxMarge) : ''}</TableCell>
                          <TableCell align="right">{m.budget ? taux(m.budget.ratios.personnelSurMarge) : ''}</TableCell>
                          <TableCell align="right">{m.budget ? milliers(m.budget.ebe) : ''}</TableCell>
                          <TableCell align="right">{m.budget ? <RatioEbe valeur={m.budget.ratios.ebeSurCA} max={ebeMax} /> : ''}</TableCell>
                          <TableCell align="right" sx={m.pointBas !== null && m.pointBas < 0 ? { color: 'error.main', fontWeight: 600 } : undefined}>{m.pointBas === null ? '' : milliers(m.pointBas)}</TableCell>
                          <TableCell>{m.majLe ? dateHeure(m.majLe) : ''}</TableCell>
                        </TableRow>
                      )
                    })}
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

import { useMemo, useState } from 'react'
import { Navigate, Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { PropositionsSerie } from '../components/PropositionsSerie'
import { estDirecteur, estEquipe } from '../auth/roles'
import { EtatVide } from '../components/EtatVide'
import { Indicateur } from '../components/Indicateur'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { anneeBudget, chargerActions, chargerAlertes, chargerBudgets, chargerCommentairesOuverts, chargerParametres, chargerReelDuCompte, departTresorerie, hypothesesDe, parametresDuBudget } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { aTraiter, correspond, filtrerMagasins, FILTRES, type Filtre } from '../lib/aFaire'
import { lienMagasin, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { tresorerieBudget } from '../moteur/tresorerie'
import { syntheseBudgets, totalBudgets } from '../moteur/sante'
import type { Alerte } from '../moteur/alertes'
import { campagneDe, enRetard } from '../moteur/campagne'
import { pretsAValider } from '../moteur/changements'
import { ValidationSerie } from '../components/ValidationSerie'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import PlaylistAddCheckOutlined from '@mui/icons-material/PlaylistAddCheckOutlined'
import { styleTableau } from '../theme/tableau'
import { annees, anneeSuivi } from '../data/annees'

// Liste des magasins (lot 27) : une ligne par magasin, colonnes triables, alertes et EBE / CA lisibles d'un coup d'œil
// Allègement (Joseph, 03/11/2026) : six colonnes ; marge, % FP, EBE en euros et date de mise à jour restent dans la fiche
// du magasin et dans l'export. « À faire » réunit les alertes et l'équipe ou les frais à renseigner.
const ENTETES = [
  { cle: 'magasin', libelle: 'Magasin' },
  { cle: 'groupe', libelle: 'Groupe' },
  { cle: 'statut', libelle: 'Budget' },
  { cle: 'ca', libelle: 'CA HT', droite: true },
  { cle: 'ebeSurCA', libelle: 'EBE / CA', droite: true },
  { cle: 'pointBas', libelle: 'Point bas de trésorerie', droite: true },
  { cle: 'alertes', libelle: 'À faire' },
] as const
type Tri = (typeof ENTETES)[number]['cle']
const COLONNES_TRI = ENTETES.map((c) => c.cle)
// Texte : A à Z d'abord ; chiffres et alertes : le plus grand d'abord ; masse salariale : la plus faible d'abord
const SENS_DEFAUT: Record<Tri, 'asc' | 'desc'> = {
  magasin: 'asc', groupe: 'asc', statut: 'asc', alertes: 'desc', ca: 'desc', ebeSurCA: 'desc', pointBas: 'asc',
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
  // Pendant une campagne ouverte par le Directeur, la liste mène au budget du magasin ; sinon à son suivi (0027).
  // Tant que les années suivent le calendrier (base pas encore en 0027), rien ne change : la liste mène au suivi.
  const campagne = annees().campagne
  const ongletListe = campagne && annees().pilotees ? 'budget' : 'synthese'
  const { donnees, erreur, chargement, recharger } = useChargement(
    async () => {
      // Plan d'action : seulement pour « À traiter » ; sans lui, la liste s'affiche quand même
      // Lot 43 : Responsables Régionaux et Coachs de chaque magasin, tenus dans l'app du réseau ; sans eux, la campagne reste globale
      const [d, { parametres }, alertes, actions, compte, commentaires] = await Promise.all([
        chargerBudgets(annee), chargerParametres(annee), chargerAlertes(), estEquipe(profil) ? chargerActions().catch(() => []) : Promise.resolve([]),
        estEquipe(profil) ? chargerReelDuCompte(anneeSuivi()).catch(() => null) : Promise.resolve(null),
        estEquipe(profil) ? chargerCommentairesOuverts(annee).catch(() => ({} as Record<string, number>)) : Promise.resolve({} as Record<string, number>),
      ])
      const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
      const campagne = campagneDe(parametres, annee)
      const aujourdhui = new Date().toISOString().slice(0, 10)
      return {
        d, parametres, groupes: d.groupes, alertes, actions, campagne,
        magasins: d.magasins.map((l) => {
          const h = hypothesesDe(l, d)
          const pL = parametresDuBudget(l, parametres)
          const budget = h ? calculerBudget(h.hypotheses, pL) : null
          const auSiege = l.base ? hypothesesDe(l, d, l.siege ?? {}) : null
          const rrs = compte?.rrs[l.magasin] ?? [], coach = compte?.coachs[l.magasin] || null
          return {
            ...l, groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '', budget,
            rrs, coach, responsables: [...rrs, ...(coach ? [coach] : [])], enRetard: enRetard(l.statut, campagne, aujourdhui),
            ebeSiege: auSiege ? calculerBudget(auSiege.hypotheses, pL).ebe : null, ebe: budget?.ebe ?? null, commentaires: commentaires[l.magasin] ?? 0,
            pointBas: budget && h ? tresorerieBudget(budget, h.hypotheses, pL, pL.tresorerie, departTresorerie(l, d, pL) ?? 0).pointBas.montant : null,
            aEquipe: !!d.equipes[l.magasin]?.length || !!h?.hypotheses.reprise?.personnel, aFrais: !!d.frais[l.magasin]?.length || !!h?.hypotheses.reprise?.frais,
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
  const responsable = params.get('responsable')
  // Lot 43 : panneau ouvert depuis le bandeau de la campagne (proposer ou valider en série)
  const [panneau, setPanneau] = useState<'proposer' | 'valider' | null>(null)
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
    const l = filtrerMagasins(tous, filtre, recherche, groupe, responsable)
    if (!tri) return l
    const valeur = (m: (typeof l)[number]): number | string | null => {
      switch (tri) {
        case 'magasin': return m.magasin
        case 'groupe': return m.groupe || null
        case 'statut': return m.statut ?? null
        case 'alertes': return (alertesDe.get(m.magasin)?.length ?? 0) + (m.aEquipe ? 0 : 1) + (m.aFrais ? 0 : 1)
        case 'pointBas': return m.pointBas
        case 'ca': return m.budget?.ca ?? null
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
  }, [tous, filtre, recherche, groupe, responsable, tri, sens, alertesDe])
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
  const prets = donnees ? pretsAValider(donnees.d.magasins.filter((l) => l.base)).length : 0
  const etat = { liste: visibles.map((m) => m.magasin), retour: params.toString() }

  const entete = (
    <>
      <Typography variant="h1">{profil?.role === 'franchise' ? 'Mes magasins' : `Budgets ${annee}`}</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>{campagne ? `Campagne ${annee} ouverte` : `Budgets ${annee} de l’année suivie`}</Typography>
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
          {/* Lot 43 (Joseph, 03/11/2026) : un seul bandeau, la campagne, ses actions en série et ce qui reste à traiter */}
          {estEquipe(profil) && profil && (
            <Box sx={{ mb: 3 }}>
              <CampagneBudgets
                annee={annee} campagne={donnees.campagne} magasins={tous} aujourdhui={new Date().toISOString().slice(0, 10)} role={profil.role}
                chiffres={synthese ? { ca: synthese.ca, ebe: synthese.ebe, ebeSurCA: synthese.ebeSurCA, avecBudget: synthese.avecBudget } : null}
                filtrer={(f, r) => {
                  setParams((p) => { const n = new URLSearchParams(p); if (f === 'tous') n.delete('filtre'); else n.set('filtre', f); if (r) n.set('responsable', r); else n.delete('responsable'); return n }, { replace: true })
                  document.querySelector('[aria-label="Filtres"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                actions={((estDirecteur(profil) && campagne) || prets > 0) && (estDirecteur(profil) || profil.role === 'rr') ? (
                  <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap' }} className="pas-a-l-impression" aria-label="Actions en série">
                    {estDirecteur(profil) && campagne && (
                      <Button variant={panneau === 'proposer' ? 'contained' : 'outlined'} startIcon={<PlaylistAddCheckOutlined />} aria-expanded={panneau === 'proposer'}
                        onClick={() => setPanneau(panneau === 'proposer' ? null : 'proposer')} sx={{ minHeight: 48 }}>Proposer en série</Button>
                    )}
                    {prets > 0 && (
                      <Button variant={panneau === 'valider' ? 'contained' : 'outlined'} color="success" startIcon={<DoneAllOutlined />} aria-expanded={panneau === 'valider'}
                        onClick={() => setPanneau(panneau === 'valider' ? null : 'valider')} sx={{ minHeight: 48 }}>{`Valider en série · ${prets}`}</Button>
                    )}
                  </Stack>
                ) : undefined}
              >
                <ATraiter
                  items={aTraiter(tous, donnees.alertes, donnees.actions, new Date().toISOString().slice(0, 10)).filter((x) => x.cle === 'alertes' || x.cle === 'actions')}
                  etat={{ liste: tous.map((m) => m.magasin) }}
                  filtrer={(f) => { changer('filtre', f === 'tous' ? null : f); document.querySelector('[aria-label="Filtres"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                />
              </CampagneBudgets>
            </Box>
          )}
          {/* Lot 42 (proposition 6) : le RR ou le Directeur valide d'un coup les budgets envoyés sans changement */}
          {panneau === 'valider' && (estDirecteur(profil) || profil?.role === 'rr') && (
            <ValidationSerie d={donnees.d} parametres={donnees.parametres} annee={annee} apres={recharger} />
          )}
          {/* Lot 41 (proposition 1) : le Directeur propose et met à jour les budgets de la liste affichée en une fois */}
          {panneau === 'proposer' && estDirecteur(profil) && (
            <Box sx={{ mb: 3 }} className="pas-a-l-impression">
              <PropositionsSerie annee={annee} magasins={visibles.map((m) => m.magasin)} apres={recharger} />
            </Box>
          )}
          {/* Lot 43 : les chiffres des budgets sont dans le bandeau de la campagne ; le franchisé à plusieurs magasins les garde */}
          {synthese && !estEquipe(profil) && (
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
            {/* Lot 43 : Responsable Régional ou Coach choisi dans la campagne */}
            {responsable && (
              <Chip label={responsable} onDelete={() => changer('responsable', null)} deleteIcon={<CloseOutlined aria-label={`Retirer le filtre : ${responsable}`} />}
                color="primary" sx={{ height: { xs: 48, md: 36 }, fontSize: '0.875rem' }} />
            )}
          </Stack>

          {visibles.length === 0 && (
            <EtatVide titre="Aucun magasin ne correspond" texte="Change de filtre ou de recherche pour retrouver tes magasins." />
          )}

          {telephone ? (
            <Stack spacing={1.5}>
              {visibles.map((m) => (
                <Card key={m.magasin}>
                  <CardActionArea component={RouterLink} to={lienMagasin(m.magasin, ongletListe)} state={etat} sx={{ p: 2, minHeight: 56 }}>
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
                <Table size="small" className="colonne-fixe" aria-label={`Budgets ${annee} par magasin`} sx={styleTableau}>
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
                        <TableCell align="right">{milliers(total.ca)}</TableCell>
                        <TableCell align="right"><RatioEbe valeur={total.ebeSurCA} max={ebeMax} /></TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    )}
                    {visibles.map((m) => {
                      const alertes = alertesDe.get(m.magasin) ?? []
                      return (
                        <TableRow key={m.magasin} hover onClick={() => navigate(lienMagasin(m.magasin, ongletListe), { state: etat })} sx={{ cursor: 'pointer' }}>
                          <TableCell><Link component={RouterLink} to={lienMagasin(m.magasin, ongletListe)} state={etat} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link></TableCell>
                          {avecGroupe && <TableCell>{m.groupe}</TableCell>}
                          <TableCell><PastilleStatut statut={m.statut} /></TableCell>
                          <TableCell align="right">{m.budget ? milliers(m.budget.ca) : ''}</TableCell>
                          <TableCell align="right">{m.budget ? <RatioEbe valeur={m.budget.ratios.ebeSurCA} max={ebeMax} /> : ''}</TableCell>
                          <TableCell align="right" sx={m.pointBas !== null && m.pointBas < 0 ? { color: 'error.main', fontWeight: 600 } : undefined}>{m.pointBas === null ? '' : milliers(m.pointBas)}</TableCell>
                          <TableCell>
                            {alertes.length > 0 && <Box component="span" sx={{ color: 'error.main', fontWeight: 600, display: 'block' }}>{texteAlertes(alertes)}</Box>}
                            {(!m.aEquipe || !m.aFrais) && <Box component="span" sx={{ color: 'text.secondary', display: 'block' }}>{!m.aEquipe && !m.aFrais ? 'Équipe et frais' : !m.aEquipe ? 'Équipe' : 'Frais'} à renseigner</Box>}
                          </TableCell>
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

import { useMemo } from 'react'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
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
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { AlertesMagasins } from '../components/AlertesMagasins'
import { EtatVide } from '../components/EtatVide'
import { Indicateur } from '../components/Indicateur'
import { Panne } from '../components/Panne'
import { chargerAlertes, chargerBudgets, chargerParametres, chargerReelDuCompte, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { feuilleReseau } from '../lib/exports'
import { ecartTaux, lienMagasin, milliers, MOIS, taux } from '../lib/format'
import { classeur, nomFichier, telecharger } from '../lib/xlsx'
import { fraisDepuisLignes } from '../moteur/atterrissage'
import { calculerBudget } from '../moteur/budget'
import { medianes, ratiosDuReel, RATIOS, type CleRatio } from '../moteur/comparaison'
import { ligneReseau, totalReseau, type LigneReseau, type MoisReel } from '../moteur/suivi'

type Cle = 'magasin' | 'moisRealises' | 'ca' | 'evolution' | 'ecartBudget' | 'tauxMarge' | 'panierCave' | 'ticketsCave' | 'panierBar' | 'ticketsBar' | 'personnelSurMarge' | 'loyerSurCA' | 'ebeSurCA'
type Colonne = { cle: Exclude<Cle, 'magasin'>; libelle: string; texte: (v: number) => string; rouge?: (v: number) => boolean }

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const COLONNES: Colonne[] = [
  { cle: 'moisRealises', libelle: 'Réel à fin', texte: (v) => (v ? MOIS[v - 1] : 'Aucun') },
  { cle: 'ca', libelle: 'CA HT', texte: milliers },
  { cle: 'evolution', libelle: 'Évolution sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0 },
  { cle: 'ecartBudget', libelle: 'Écart au budget', texte: ecartTaux, rouge: (v) => v < 0 },
  { cle: 'tauxMarge', libelle: 'Taux de marge', texte: taux },
  { cle: 'panierCave', libelle: 'Panier Cave TTC', texte: (v) => euros.format(v) },
  { cle: 'ticketsCave', libelle: 'Tickets Cave sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0 },
  { cle: 'panierBar', libelle: 'Panier Bar TTC', texte: (v) => euros.format(v) },
  { cle: 'ticketsBar', libelle: 'Tickets Bar sur l’an dernier', texte: ecartTaux, rouge: (v) => v < 0 },
  { cle: 'personnelSurMarge', libelle: 'Masse salariale / marge', texte: taux },
  { cle: 'loyerSurCA', libelle: 'Loyer / CA', texte: taux },
  { cle: 'ebeSurCA', libelle: 'EBE / CA', texte: taux, rouge: (v) => v < 0 },
]
const douze = (): MoisReel[] => Array.from({ length: 12 }, () => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 }))
// Sur téléphone, les chiffres d'abord : Coach, RR et groupe restent dans les filtres
const surPC = { display: { xs: 'none', md: 'table-cell' } }
const simple = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// Vue réseau : chaque magasin à la fin de son dernier mois réalisé, face à l'an dernier, à son budget et au total du réseau
export function Reseau() {
  const annee = new Date().getFullYear()
  const { donnees, erreur, chargement, recharger } = useChargement(async () => {
    const [d, { parametres }, reel, alertes] = await Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReelDuCompte(annee), chargerAlertes()])
    const groupes = new Map(d.groupes.map((g) => [g.id, g.nom]))
    const p = { tauxRedevance: parametres.tauxRedevance, tauxPublicite: parametres.tauxPublicite, charges: parametres.charges, annee }
    const magasins = d.magasins.map((l) => {
      const h = l.statut ? hypothesesDe(l, d) : null
      const frais = d.frais[l.magasin]
      return {
        ...ligneReseau({
          magasin: l.magasin, n: reel.magasins[l.magasin]?.n ?? douze(), n1: reel.magasins[l.magasin]?.n1 ?? douze(),
          budget: h ? calculerBudget(h.hypotheses, parametres) : null,
          equipe: d.equipes[l.magasin], frais: frais?.length ? fraisDepuisLignes(frais).frais : undefined,
        }, p),
        groupeId: l.groupeId, groupe: l.groupeId ? groupes.get(l.groupeId) ?? '' : '', coach: reel.coachs[l.magasin] ?? '', rrs: reel.rrs[l.magasin] ?? [],
      }
    })
    const trie = (l: string[]) => [...new Set(l)].sort((a, b) => a.localeCompare(b, 'fr'))
    return { magasins, alertes, groupes: d.groupes, coachs: trie(Object.values(reel.coachs)), rrs: trie(Object.values(reel.rrs).flat()) }
  }, [annee])

  // Filtres et tri gardés dans l'adresse : le retour depuis une fiche les retrouve
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const changer = (valeurs: Record<string, string | null>) => setParams((p) => {
    const n = new URLSearchParams(p)
    for (const [k, v] of Object.entries(valeurs)) if (v) n.set(k, v); else n.delete(k)
    return n
  }, { replace: true })
  const recherche = params.get('q') ?? ''
  const groupe = params.get('groupe') ? Number(params.get('groupe')) : null
  const coach = params.get('coach') ?? ''
  const rr = params.get('rr') ?? ''
  const tri = ([...COLONNES.map((c) => c.cle), 'magasin'] as string[]).includes(params.get('tri') ?? '') ? params.get('tri') as Cle : 'ca'
  const sens = params.get('sens') === 'asc' ? 'asc' : params.get('sens') === 'desc' ? 'desc' : tri === 'magasin' ? 'asc' : 'desc'

  const visibles = useMemo(() => {
    const q = simple(recherche)
    const l = (donnees?.magasins ?? []).filter((m) => (groupe === null || m.groupeId === groupe) && (!coach || m.coach === coach) && (!rr || m.rrs.includes(rr)) && (!q || simple(m.magasin).includes(q)))
    // Valeur absente toujours en bas, quel que soit le sens
    return [...l].sort((a, b) => {
      if (tri === 'magasin') return (sens === 'asc' ? 1 : -1) * a.magasin.localeCompare(b.magasin, 'fr')
      const x = a[tri], y = b[tri]
      if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1
      return sens === 'asc' ? x - y : y - x
    })
  }, [donnees, recherche, groupe, coach, rr, tri, sens])
  const total = totalReseau(visibles)
  // Médiane de la sélection : un groupe filtré donne la médiane du groupe
  const mediane = medianes(visibles.filter((m) => m.moisRealises > 0).map(ratiosDuReel))
  const filtre = visibles.length !== (donnees?.magasins.length ?? 0)
  const etat = { liste: visibles.map((m) => m.magasin), retour: params.toString(), depuis: { chemin: '/reseau', nom: 'Réseau' } }
  const trier = (cle: Cle) => changer({ tri: cle, sens: tri === cle ? (sens === 'asc' ? 'desc' : 'asc') : cle === 'magasin' ? 'asc' : 'desc' })
  const sousBudget = visibles.filter((m) => m.ecartBudget !== null && m.ecartBudget < 0).length
  const avecBudget = visibles.filter((m) => m.ecartBudget !== null).length
  // Sélection en clair, reprise dans l'export et sur la page imprimée
  const selection = [
    groupe !== null ? donnees?.groupes.find((g) => g.id === groupe)?.nom : '', coach, rr, recherche.trim() ? `« ${recherche.trim()} »` : '',
  ].filter(Boolean).join(' · ') || 'Tout le réseau'
  const exporter = () => {
    if (!donnees) return
    const avec = { coach: donnees.coachs.length > 0, rr: donnees.rrs.length > 0, groupe: donnees.groupes.length > 0 }
    telecharger(nomFichier(`Réseau ${annee}${selection === 'Tout le réseau' ? '' : ` - ${selection.replace(/[«»]/g, '')}`}`),
      classeur([feuilleReseau({ annee, selection, lignes: visibles, total, avec })]))
  }

  const titre = (actions?: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
      <Box sx={{ flex: 1, minWidth: 240 }}>
        <Typography variant="h1">Réseau</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          Réel {annee}, magasin par magasin<Box component="span" className="impression-seule"> · {selection} · imprimé le {new Date().toLocaleDateString('fr-FR')}</Box>
        </Typography>
      </Box>
      {actions}
    </Box>
  )
  const entete = titre()
  if (chargement && !donnees) return <Box>{entete}<Stack spacing={2}><Skeleton variant="rounded" height={120} /><Skeleton variant="rounded" height={320} /></Stack></Box>
  if (erreur || !donnees) return <Box>{entete}<Panne quoi={`Le réel ${annee} du réseau`} recharger={recharger} /></Box>
  if (!donnees.magasins.some((m) => m.moisRealises > 0)) {
    return <Box>{entete}<EtatVide titre={`Pas encore de réel ${annee}`} texte={`La vue réseau compare les magasins à partir des chiffres réels ${annee}, importés chaque mois depuis la caisse.`} /></Box>
  }

  const cellule = (c: Colonne, v: number | null, fort = false) => (
    <TableCell key={c.cle} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: fort ? 700 : 400, color: v !== null && c.rouge?.(v) ? 'error.main' : v === null ? 'text.disabled' : undefined }}>
      {v === null ? '–' : c.texte(v)}
    </TableCell>
  )
  const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }

  return (
    <Box>
      {titre(
        <Stack direction="row" spacing={1.5} className="pas-a-l-impression" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exporter} disabled={visibles.length === 0} sx={{ minHeight: 48, flex: { xs: 1, sm: 'none' } }}>Exporter en Excel</Button>
          <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()} disabled={visibles.length === 0} sx={{ minHeight: 48, display: { xs: 'none', md: 'inline-flex' } }}>Imprimer</Button>
        </Stack>,
      )}
      <Box component="section" aria-label={`Réseau ${annee} en chiffres`} sx={{ display: 'grid', gap: 2, mb: 4, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Indicateur
          libelle="CA HT cumulé" valeur={milliers(total.ca)}
          ecart={total.evolution === null ? undefined : { texte: `${ecartTaux(total.evolution)} sur ${annee - 1}`, hausse: total.evolution >= 0, favorable: total.evolution >= 0 }}
          detail={`${total.magasins} magasin${total.magasins > 1 ? 's' : ''} avec du réel`}
        />
        <Indicateur
          libelle="Écart au budget" valeur={total.ecartBudget === null ? 'Pas de budget' : ecartTaux(total.ecartBudget)}
          detail={avecBudget ? `${sousBudget} magasin${sousBudget > 1 ? 's' : ''} sous le budget sur ${avecBudget}` : `Aucun budget ${annee} dans l’app`}
        />
        <Indicateur libelle="Taux de marge" valeur={total.tauxMarge === null ? 'Non connu' : taux(total.tauxMarge)} detail={[total.panierCave === null ? '' : `Panier Cave ${euros.format(total.panierCave)}`, total.panierBar === null ? '' : `Bar ${euros.format(total.panierBar)}`].filter(Boolean).join(' · ') || undefined} />
        <Indicateur
          libelle="Masse salariale / marge" valeur={total.personnelSurMarge === null ? 'À renseigner' : taux(total.personnelSurMarge)}
          detail={total.ebeSurCA === null ? 'Équipe et frais à renseigner' : `EBE à date : ${taux(total.ebeSurCA)} du CA`}
        />
      </Box>

      <Box className="pas-a-l-impression" sx={{ mb: 4 }}>
        <AlertesMagasins alertes={donnees.alertes.filter((a) => visibles.some((m) => m.magasin === a.magasin))} etat={etat} />
      </Box>

      <Stack direction="row" spacing={2} useFlexGap className="pas-a-l-impression" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small" value={recherche} onChange={(e) => changer({ q: e.target.value })} placeholder="Rechercher un magasin"
          slotProps={{ htmlInput: { 'aria-label': 'Rechercher un magasin' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
          sx={{ width: { xs: '100%', sm: 300 }, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
        />
        {donnees.groupes.length > 0 && (
          <TextField select size="small" label="Groupe" value={groupe ?? ''} onChange={(e) => changer({ groupe: e.target.value || null })}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 220 }, ...champ }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Tous les groupes</MenuItem>
            {donnees.groupes.map((g) => <MenuItem key={g.id} value={g.id} sx={{ minHeight: 48 }}>{g.nom}</MenuItem>)}
          </TextField>
        )}
        {donnees.coachs.length > 1 && (
          <TextField select size="small" label="Coach" value={coach} onChange={(e) => changer({ coach: e.target.value || null })}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 220 }, ...champ }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Tous les Coachs</MenuItem>
            {donnees.coachs.map((c) => <MenuItem key={c} value={c} sx={{ minHeight: 48 }}>{c}</MenuItem>)}
          </TextField>
        )}
        {donnees.rrs.length > 1 && (
          <TextField select size="small" label="Responsable Régional" value={rr} onChange={(e) => changer({ rr: e.target.value || null })}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: { xs: '100%', sm: 240 }, ...champ }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Tous les Responsables Régionaux</MenuItem>
            {donnees.rrs.map((r) => <MenuItem key={r} value={r} sx={{ minHeight: 48 }}>{r}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {visibles.length === 0 ? (
        <EtatVide titre="Aucun magasin ne correspond" texte="Change de filtre ou de recherche pour retrouver les magasins." />
      ) : (
        <Card>
          <TableContainer>
            <Table size="small" className="colonne-fixe" aria-label={`Réel ${annee} par magasin`} sx={{ '& td, & th': { px: 1.25 }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={tri === 'magasin' ? sens : false} sx={{ minWidth: 180 }}>
                    <TableSortLabel active={tri === 'magasin'} direction={tri === 'magasin' ? sens : 'asc'} onClick={() => trier('magasin')} sx={{ minHeight: { xs: 48, md: 36 } }}>Magasin</TableSortLabel>
                  </TableCell>
                  {donnees.coachs.length > 0 && <TableCell sx={surPC}>Coach</TableCell>}
                  {donnees.rrs.length > 0 && <TableCell sx={surPC}>Responsable Régional</TableCell>}
                  {donnees.groupes.length > 0 && <TableCell sx={surPC}>Groupe</TableCell>}
                  {COLONNES.map((c) => (
                    <TableCell key={c.cle} align="right" sortDirection={tri === c.cle ? sens : false} sx={{ whiteSpace: 'normal', minWidth: 96, verticalAlign: 'bottom' }}>
                      <TableSortLabel active={tri === c.cle} direction={tri === c.cle ? sens : 'desc'} onClick={() => trier(c.cle)} sx={{ minHeight: { xs: 48, md: 36 } }}>{c.libelle}</TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ bgcolor: 'background.default', '& td': { bgcolor: 'background.default' } }}>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{filtre ? 'Total de la sélection' : 'Total du réseau'}</TableCell>
                  {donnees.coachs.length > 0 && <TableCell sx={surPC} />}
                  {donnees.rrs.length > 0 && <TableCell sx={surPC} />}
                  {donnees.groupes.length > 0 && <TableCell sx={surPC} />}
                  {COLONNES.map((c) => (c.cle === 'moisRealises'
                    ? <TableCell key={c.cle} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{total.magasins} magasin{total.magasins > 1 ? 's' : ''}</TableCell>
                    : cellule(c, (total as unknown as Record<string, number | null>)[c.cle], true)))}
                </TableRow>
                <TableRow sx={{ '& td': { color: 'text.secondary' } }}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{filtre ? 'Médiane de la sélection' : 'Médiane du réseau'}</TableCell>
                  {donnees.coachs.length > 0 && <TableCell sx={surPC} />}
                  {donnees.rrs.length > 0 && <TableCell sx={surPC} />}
                  {donnees.groupes.length > 0 && <TableCell sx={surPC} />}
                  {COLONNES.map((c) => ((RATIOS as string[]).includes(c.cle)
                    ? cellule(c, mediane[c.cle as CleRatio])
                    : <TableCell key={c.cle} />))}
                </TableRow>
                {visibles.map((m) => (
                  <TableRow key={m.magasin} hover onClick={() => navigate(lienMagasin(m.magasin), { state: etat })} sx={{ cursor: 'pointer' }}>
                    <TableCell>
                      <Link component={RouterLink} to={lienMagasin(m.magasin)} state={etat} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, display: 'inline-flex', minHeight: 48, alignItems: 'center' }}>{m.magasin}</Link>
                    </TableCell>
                    {donnees.coachs.length > 0 && <TableCell sx={{ whiteSpace: 'nowrap', ...surPC }}>{m.coach}</TableCell>}
                    {donnees.rrs.length > 0 && <TableCell sx={{ whiteSpace: 'nowrap', ...surPC }}>{m.rrs.join(', ')}</TableCell>}
                    {donnees.groupes.length > 0 && <TableCell sx={{ whiteSpace: 'nowrap', ...surPC }}>{m.groupe}</TableCell>}
                    {COLONNES.map((c) => (c.cle === 'moisRealises'
                      ? cellule(c, m.moisRealises || null)
                      : cellule(c, m[c.cle as keyof LigneReseau] as number | null)))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  )
}

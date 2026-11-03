import { Fragment, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import type { Role } from '../auth/roles'
import type { Statut } from '../data/pilotage'
import type { Filtre } from '../lib/aFaire'
import { lienMagasin, milliers, taux } from '../lib/format'
import {
  avancementCampagne, avancementParRR, ETAPES_CAMPAGNE, etapeCampagne, magasinsCampagne,
  type Avancement, type Campagne, type EtapeCampagne,
} from '../moteur/campagne'

const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const pluriel = (n: number, un: string, plusieurs: string) => (n === 1 ? `1 ${un}` : `${n} ${plusieurs}`)
// Étape de la campagne → filtre de la liste des magasins
export const FILTRE_ETAPE: Record<EtapeCampagne, Filtre> = { a_proposer: 'sans_budget', chez_franchise: 'propose', retour: 'en_discussion', valide: 'valide' }
const COULEUR: Record<EtapeCampagne, string> = { a_proposer: 'divider', chez_franchise: 'grey.500', retour: 'secondary.main', valide: 'success.main' }
const COLONNES: { cle: Exclude<keyof Avancement, 'nom' | 'magasins' | 'commentaires'>; libelle: string; filtre: Filtre }[] = [
  { cle: 'aProposer', libelle: 'À proposer', filtre: 'sans_budget' }, { cle: 'proposes', libelle: 'Chez le franchisé', filtre: 'propose' },
  { cle: 'enDiscussion', libelle: 'Retour', filtre: 'en_discussion' }, { cle: 'valides', libelle: 'Validés', filtre: 'valide' },
  { cle: 'enRetard', libelle: 'En retard', filtre: 'en_retard' },
]

export interface MagasinCampagneListe {
  magasin: string; statut: Statut | null; majLe: string | null; envoyeLe?: string | null
  rrs: string[]; coach: string | null; ebeSiege: number | null; ebe: number | null
  commentaires?: number // commentaires encore ouverts sur le budget
}
type Filtrer = (f: Filtre, responsable?: string | null) => void

// Un chiffre du tableau : il ouvre la liste des magasins correspondants ; zéro reste un simple texte
function Chiffre({ n, quoi, onClick, rouge }: { n: number; quoi: string; onClick: () => void; rouge?: boolean }) {
  if (!n) return <>{n}</>
  return (
    <Link component="button" type="button" onClick={onClick} aria-label={`${n} : ${quoi}`}
      sx={{ minHeight: 48, minWidth: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: 700, fontSize: 'inherit', color: rouge ? 'error.main' : 'text.primary', textDecorationColor: 'currentColor' }}>
      {n}
    </Link>
  )
}

function TableauResponsables({ titre, lignes, sansNom, filtrer, sousLignes, libelleSous }: {
  titre: string; lignes: Avancement[]; sansNom: string; filtrer: Filtrer
  sousLignes?: (nom: string) => Avancement[]; libelleSous?: string
}) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const ligne = (l: Avancement, sous: boolean) => (
    <TableRow key={`${sous ? 'sous-' : ''}${l.nom}`} sx={sous ? { bgcolor: 'action.hover' } : undefined}>
      <TableCell sx={{ fontWeight: sous ? 400 : 600, pl: sous ? '40px !important' : undefined }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {l.nom || sansNom}
          {!sous && sousLignes && l.nom && (
            <IconButton size="small" aria-expanded={ouverts.has(l.nom)} aria-label={`${ouverts.has(l.nom) ? 'Replier' : 'Voir'} les ${libelleSous} de ${l.nom}`}
              onClick={() => setOuverts((o) => { const n = new Set(o); if (n.has(l.nom)) n.delete(l.nom); else n.add(l.nom); return n })} sx={{ width: 48, height: 48 }}>
              {ouverts.has(l.nom) ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
            </IconButton>
          )}
        </Box>
      </TableCell>
      <TableCell align="right">{l.magasins}</TableCell>
      {COLONNES.map((c) => (
        <TableCell key={c.cle} align="right">
          <Chiffre n={l[c.cle]} quoi={`${c.libelle.toLowerCase()}, ${l.nom || sansNom}`} rouge={c.cle === 'enRetard'} onClick={() => filtrer(c.filtre, l.nom || null)} />
        </TableCell>
      ))}
      <TableCell align="right" sx={{ color: l.commentaires ? 'warning.dark' : 'text.secondary', fontWeight: l.commentaires ? 700 : 400 }}>{l.commentaires}</TableCell>
    </TableRow>
  )
  return (
    <TableContainer>
      <Table size="small" aria-label={titre} sx={{ '& td, & th': { px: 1.25, py: 0, whiteSpace: 'nowrap', height: 48 }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
        <TableHead>
          <TableRow>
            <TableCell>{titre}</TableCell>
            <TableCell align="right">Magasins</TableCell>
            {COLONNES.map((c) => <TableCell key={c.cle} align="right">{c.libelle}</TableCell>)}
            <TableCell align="right">Commentaires ouverts</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lignes.map((l) => (
            <Fragment key={l.nom}>
              {ligne(l, false)}
              {sousLignes && ouverts.has(l.nom) && sousLignes(l.nom).map((s) => ligne(s, true))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// Campagne des budgets (lot 28, refondue au lot 43, Joseph 03/11/2026) : un seul bandeau en tête de la liste des magasins.
// Les quatre étapes (à proposer, chez le franchisé, retour du franchisé, validés), chacune ouvre la liste filtrée ; puis
// le détail selon qui regarde : le Directeur par Responsable Régional (déplié sur ses Coachs), le RR par Coach, le Coach
// ses magasins un par un avec le temps d'attente. Les noms des RR et Coachs viennent de l'app du réseau.
export function CampagneBudgets({ annee, campagne, magasins, aujourdhui, role, chiffres, filtrer, actions, children }: {
  annee: number
  campagne: Campagne
  magasins: MagasinCampagneListe[]
  aujourdhui: string
  role: Role
  chiffres: { ca: number; ebe: number; ebeSurCA: number; avecBudget: number } | null
  filtrer: Filtrer
  actions?: ReactNode
  children?: ReactNode
}) {
  // Allègement (Joseph, 03/11/2026) : les étapes se filtrent dans la rangée de filtres de la liste, le détail par
  // Responsable Régional ou par Coach s'ouvre à la demande
  const [voirDetail, setVoirDetail] = useState(false)
  const total = avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: ['Tout le périmètre'] })), campagne, aujourdhui)[0]
  if (!total) return null
  const parEtape = Object.fromEntries(ETAPES_CAMPAGNE.map((e) => [e.cle, magasins.filter((m) => etapeCampagne(m.statut) === e.cle).length])) as Record<EtapeCampagne, number>
  const avecRR = magasins.some((m) => m.rrs.length), avecCoach = magasins.some((m) => m.coach)
  const etape = aujourdhui <= campagne.proposition ? `Propositions attendues avant le ${jour(campagne.proposition)}`
    : aujourdhui <= campagne.retour ? `Retours des franchisés attendus avant le ${jour(campagne.retour)}`
      : aujourdhui <= campagne.validation ? `Validations attendues avant le ${jour(campagne.validation)}` : `Campagne close depuis le ${jour(campagne.validation)}`

  const detail = role === 'coach' ? (() => {
    const lignes = magasinsCampagne(magasins, campagne, aujourdhui)
    const de = new Map(magasins.map((m) => [m.magasin, m]))
    return (
      <TableContainer>
        <Table size="small" aria-label="Mes magasins" sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Magasin</TableCell><TableCell>Étape</TableCell><TableCell align="right">Depuis</TableCell>
              <TableCell align="right">EBE proposé</TableCell><TableCell align="right">EBE du franchisé</TableCell><TableCell align="right">Commentaires ouverts</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lignes.map((l) => {
              const m = de.get(l.magasin)!
              return (
                <TableRow key={l.magasin}>
                  <TableCell><Link component={RouterLink} to={lienMagasin(l.magasin, l.etape === 'a_proposer' ? 'atterrissage' : 'echanges')} sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>{l.magasin}</Link></TableCell>
                  <TableCell>{ETAPES_CAMPAGNE.find((e) => e.cle === l.etape)!.libelle.replace(/s$/, '')}</TableCell>
                  <TableCell align="right" sx={l.enRetard ? { color: 'error.main', fontWeight: 700 } : undefined}>
                    {l.attente !== null ? pluriel(l.attente, 'jour', 'jours') : l.enRetard ? 'En retard' : ''}{l.attente !== null && l.enRetard ? ', en retard' : ''}
                  </TableCell>
                  <TableCell align="right">{m.ebeSiege === null ? '' : milliers(m.ebeSiege)}</TableCell>
                  <TableCell align="right">{l.etape === 'retour' || l.etape === 'valide' ? (m.ebe === null ? '' : milliers(m.ebe)) : ''}</TableCell>
                  <TableCell align="right" sx={{ color: m.commentaires ? 'warning.dark' : 'text.secondary', fontWeight: m.commentaires ? 700 : 400 }}>{m.commentaires ?? 0}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    )
  })() : role === 'directeur' && avecRR ? (
    <TableauResponsables titre="Par Responsable Régional" sansNom="Sans Responsable Régional" filtrer={filtrer} libelleSous="Coachs"
      lignes={avancementParRR(magasins, campagne, aujourdhui)}
      sousLignes={avecCoach ? (nom) => avancementParRR(magasins, campagne, aujourdhui).find((l) => l.nom === nom)?.coachs ?? [] : undefined} />
  ) : avecCoach ? (
    <TableauResponsables titre="Par Coach" sansNom="Sans Coach" filtrer={filtrer}
      lignes={avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: m.coach ? [m.coach] : [], commentaires: m.commentaires })), campagne, aujourdhui)} />
  ) : null

  const titreDetail = role === 'coach' ? 'Mes magasins, jours d’attente' : role === 'directeur' && avecRR ? 'Par Responsable Régional' : 'Par Coach'

  return (
    <Card component="section" aria-label={`Campagne des budgets ${annee}`}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5, display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', columnGap: 2, rowGap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="h2" sx={{ flex: 1, minWidth: 240 }}>Campagne des budgets {annee}</Typography>
          <Typography color="text.secondary">
            {etape} · {total.valides} validé{total.valides > 1 ? 's' : ''} sur {total.magasins}
            {total.enRetard > 0 && <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}> · {total.enRetard} en retard</Box>}
          </Typography>
        </Box>
        <Box aria-hidden sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: 'divider' }}>
          {(['valide', 'retour', 'chez_franchise'] as EtapeCampagne[]).map((e) => (
            <Box key={e} sx={{ width: `${(parEtape[e] / total.magasins) * 100}%`, bgcolor: COULEUR[e] }} />
          ))}
        </Box>
        {chiffres && chiffres.avecBudget > 0 && (
          <Typography variant="body2" color="text.secondary">
            {`CA HT budgété ${milliers(chiffres.ca)} · EBE budgété ${milliers(chiffres.ebe)} (${taux(chiffres.ebeSurCA)} du CA), somme des ${pluriel(chiffres.avecBudget, 'budget', 'budgets')}`}
          </Typography>
        )}
        {(actions || detail) && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {detail && (
              <Button variant={voirDetail ? 'contained' : 'outlined'} aria-expanded={voirDetail} onClick={() => setVoirDetail(!voirDetail)}
                endIcon={voirDetail ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ minHeight: 48 }}>
                {titreDetail}
              </Button>
            )}
            {actions}
          </Box>
        )}
      </Box>
      {voirDetail && detail}
      {children}
    </Card>
  )
}

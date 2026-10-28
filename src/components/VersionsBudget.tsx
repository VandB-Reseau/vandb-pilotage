import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import RestoreOutlined from '@mui/icons-material/RestoreOutlined'
import { Aide } from './Aide'
import { roleLibelle, type Profil } from '../auth/roles'
import {
  avecEquipeEtFrais, chargerVersionsNommees, enregistrerVersionNommee, hypothesesDe, retirerVersionNommee,
  type DonneesBudgets, type LigneMagasin, type VersionNommee,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartMontant, montant, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import type { Cibles } from '../moteur/cibles'
import type { Budget, ParametresReseau } from '../moteur/types'
import { comparerVersions } from '../moteur/versions'

const COLONNES_MAX = 4
const quand = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Versions nommées du budget (lot 26) : on enregistre une version (« prudente », « avec un vendeur de plus ») sans
// toucher au budget en cours, puis on les compare côte à côte. Une version garde l'équipe et les frais du moment.
export function VersionsBudget({ ligne, d, annee, parametres, budget, ajustements, peutEnregistrer, peutReprendre, moi, onReprendre }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  parametres: ParametresReseau
  budget: Budget              // budget en cours, avec la saisie de l'écran
  ajustements: Cibles
  peutEnregistrer: boolean
  peutReprendre: boolean
  moi: Profil
  onReprendre: (ajustements: Cibles) => void
}) {
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerVersionsNommees(ligne.magasin, annee), [ligne.magasin, annee])
  const [nom, setNom] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)

  const agir = async (action: () => Promise<void>, reussite: string) => {
    setOccupe(true)
    setMessage(null)
    try {
      await action()
      setMessage({ gravite: 'success', texte: reussite })
      recharger()
      return true
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
      return false
    } finally {
      setOccupe(false)
    }
  }
  const enregistrer = async () => {
    if (!nom?.trim() || !ligne.base) return
    const base = avecEquipeEtFrais(ligne.base, d.equipes[ligne.magasin], d.frais[ligne.magasin])
    if (await agir(() => enregistrerVersionNommee(ligne.magasin, annee, nom, base, ajustements), `Version « ${nom.trim()} » enregistrée.`)) setNom(null)
  }

  // Une version se recalcule avec les cibles du siège d'aujourd'hui, son équipe et ses frais du jour où elle a été enregistrée
  const budgetDe = (v: VersionNommee) => {
    const h = hypothesesDe({ ...ligne, base: v.base, statut: 'en_discussion', figees: null }, { ...d, equipes: {}, frais: {} }, v.ajustements)
    return h ? calculerBudget(h.hypotheses, parametres) : null
  }
  const versions = (donnees ?? []).slice(-COLONNES_MAX).map((v) => ({ v, b: budgetDe(v) })).filter((x): x is { v: VersionNommee; b: Budget } => !!x.b)
  const lignes = comparerVersions([budget, ...versions.map((x) => x.b)])

  return (
    <Card component="section" aria-label="Versions du budget">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Versions</Typography><Aide sujet="versions" /></Box>
        {peutEnregistrer && nom === null && (
          <Button variant="outlined" startIcon={<BookmarkAddOutlined />} onClick={() => setNom('')} sx={{ minHeight: 48 }}>Enregistrer cette version</Button>
        )}
      </Box>
      {message && (
        <Box sx={{ px: 2.5, pb: 1 }}>
          <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>
        </Box>
      )}
      {nom !== null && (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); void enregistrer() }} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', px: 2.5, pb: 2 }}>
          <TextField label="Nom de la version" value={nom} autoFocus onChange={(e) => setNom(e.target.value)} placeholder="Prudente, avec un vendeur de plus…"
            slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ minWidth: 280, flex: '1 1 280px', maxWidth: 420, '& input': { height: 48, boxSizing: 'border-box' } }} />
          <Button type="submit" variant="contained" disabled={occupe || !nom.trim()} sx={{ minHeight: 48 }}>Enregistrer</Button>
          <Button onClick={() => setNom(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
        </Box>
      )}

      {chargement && !donnees ? <Skeleton variant="rounded" height={120} sx={{ mx: 2.5, mb: 2 }} />
        : erreur ? <Typography color="text.secondary" sx={{ px: 2.5, pb: 2 }}>Les versions n’ont pas pu être chargées. Recharge la page pour réessayer.</Typography>
        : versions.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, pb: 2 }}>
            {peutEnregistrer ? 'Aucune version enregistrée. Enregistre le budget tel qu’il est, change des hypothèses, puis compare.' : 'Aucune version enregistrée pour ce magasin.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" className="colonne-fixe" aria-label={`Versions du budget ${annee}`}
              sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap', verticalAlign: 'top' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 200 } }}>
              <TableHead>
                <TableRow>
                  <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros HT</Box></TableCell>
                  <TableCell align="right">Budget en cours</TableCell>
                  {versions.map(({ v }) => (
                    <TableCell key={v.id} align="right">
                      <Box>{v.nom}</Box>
                      <Box sx={{ fontWeight: 400, color: 'text.secondary', fontSize: '0.75rem' }}>
                        {[v.auteurRole ? roleLibelle[v.auteurRole] : null, quand(v.creeLe)].filter(Boolean).join(' · ')}
                      </Box>
                      <Box className="pas-a-l-impression" sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                        {peutReprendre && (
                          <Button size="small" startIcon={<RestoreOutlined />} onClick={() => onReprendre(v.ajustements)} aria-label={`Reprendre les hypothèses de la version ${v.nom}`}
                            sx={{ minHeight: { xs: 48, md: 32 } }}>Reprendre</Button>
                        )}
                        {(moi.role === 'directeur' || v.auteur === moi.id) && (
                          <IconButton aria-label={`Retirer la version ${v.nom}`} disabled={occupe} onClick={() => void agir(() => retirerVersionNommee(v.id), `Version « ${v.nom} » retirée.`)}
                            sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 } }}><DeleteOutlined fontSize="small" /></IconButton>
                        )}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.cle} sx={l.fort ? { bgcolor: 'background.default', '& td': { bgcolor: 'background.default', fontWeight: 700 } } : undefined}>
                    <TableCell>{l.libelle}</TableCell>
                    {l.valeurs.map((v, i) => {
                      const e = l.ecarts[i]
                      const favorable = e !== null && (l.charge ? e <= 0 : e >= 0)
                      return (
                        <TableCell key={i} align="right">
                          <Box>{montant(v)}{l.taux ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> · {taux(l.taux[i])}</Box> : null}</Box>
                          {e !== null && Math.abs(e) >= 0.5 && (
                            <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: favorable ? 'success.dark' : 'error.main' }}>{ecartMontant(e)}</Box>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
    </Card>
  )
}

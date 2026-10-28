import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
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
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { Panne } from './Panne'
import { roleLibelle, type Profil, type Role } from '../auth/roles'
import {
  chargerEchanges, envoyerMessage, hypothesesDe, retirerMessage, statutLibelle, SUJETS, sujetLibelle,
  type DonneesBudgets, type LigneMagasin, type SujetEchange, type VersionBudget,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartMontant, milliers } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import type { ParametresReseau } from '../moteur/types'

const MAX_TEXTE = 2000
const VERSIONS_VISIBLES = 8
const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const qui = (role: Role | null, nom: string | null) => [role ? roleLibelle[role] : null, nom].filter(Boolean).join(' · ') || 'Compte retiré'
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }

// Chiffres clés d'une version, recalculés avec les cibles d'aujourd'hui
function chiffres(v: VersionBudget, ligne: LigneMagasin, d: DonneesBudgets, parametres: ParametresReseau) {
  if (!v.base) return null
  const h = hypothesesDe({ ...ligne, base: v.base, ajustements: v.ajustements, statut: 'en_discussion', figees: null }, d, v.ajustements)
  return h ? calculerBudget(h.hypotheses, parametres) : null
}

// « Le siège propose, on se met d'accord » : messages par sujet entre le siège, le RR, le Coach et le franchisé, et
// l'historique des versions du budget
export function EchangesBudget({ ligne, d, annee, parametres, moi }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  parametres: ParametresReseau
  moi: Profil
}) {
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerEchanges(ligne.magasin, annee), [ligne.magasin, annee, ligne.majLe])
  const [sujet, setSujet] = useState<SujetEchange>('general')
  const [texte, setTexte] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [probleme, setProbleme] = useState<string | null>(null)
  const [toutes, setToutes] = useState(false)
  const peutEcrire = moi.role !== 'aucun'

  if (chargement && !donnees) return <Skeleton variant="rounded" height={160} />
  if (erreur || !donnees) return <Panne quoi="Les échanges sur le budget" recharger={recharger} />

  const agir = async (f: () => Promise<void>, apres?: () => void) => {
    setOccupe(true)
    setProbleme(null)
    try {
      await f()
      apres?.()
      recharger()
    } catch {
      setProbleme('Le message n’est pas parti. Vérifie ta connexion, puis réessaie.')
    } finally {
      setOccupe(false)
    }
  }

  const versions = donnees.versions.map((v) => ({ v, b: chiffres(v, ligne, d, parametres) }))
  const visibles = toutes ? versions : versions.slice(0, VERSIONS_VISIBLES)

  return (
    <>
      <Card component="section" aria-label="Échanges sur le budget" className="pas-a-l-impression">
        <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Échanges sur le budget {annee}</Typography>
        {donnees.messages.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.5, pb: 1.5 }}>Aucun message pour l’instant.</Typography>
        ) : (
          <Stack component="ol" aria-label="Messages" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {donnees.messages.map((m) => (
              <Box component="li" key={m.id} sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700 }}>{qui(m.auteurRole, m.auteurNom)}</Typography>
                    <Typography variant="body2" color="text.secondary">{quand(m.creeLe)}</Typography>
                    <Chip size="small" label={sujetLibelle[m.sujet] ?? m.sujet} variant="outlined" />
                  </Box>
                  <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texte}</Typography>
                </Box>
                {m.auteur === moi.id && (
                  <IconButton aria-label="Retirer mon message" disabled={occupe} onClick={() => void agir(() => retirerMessage(m.id))} sx={{ width: 48, height: 48 }}>
                    <DeleteOutlined />
                  </IconButton>
                )}
              </Box>
            ))}
          </Stack>
        )}
        {peutEcrire && (
          <Box sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: 'divider' }}>
            {probleme && <Alert severity="error" sx={{ mb: 1.5 }}>{probleme}</Alert>}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
              <TextField select size="small" label="Sujet" value={sujet} onChange={(e) => setSujet(e.target.value as SujetEchange)} sx={{ width: { xs: '100%', md: 200 }, ...champ }}>
                {SUJETS.map((s) => <MenuItem key={s} value={s} sx={{ minHeight: 48 }}>{sujetLibelle[s]}</MenuItem>)}
              </TextField>
              <TextField label="Message" value={texte} onChange={(e) => setTexte(e.target.value.slice(0, MAX_TEXTE))} multiline minRows={2} maxRows={8} sx={{ flex: 1 }}
                helperText={texte.length > MAX_TEXTE - 200 ? `${MAX_TEXTE - texte.length} caractères restants` : undefined} />
              <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe || !texte.trim()} sx={{ minHeight: 48, alignSelf: { xs: 'flex-start', md: 'flex-start' } }}
                onClick={() => void agir(() => envoyerMessage(ligne.magasin, annee, sujet, texte), () => { setTexte(''); setSujet('general') })}>
                Envoyer
              </Button>
            </Stack>
          </Box>
        )}
      </Card>

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

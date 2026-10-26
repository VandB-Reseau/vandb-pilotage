import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import TableContainer from '@mui/material/TableContainer'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { lignesCibles, TableauCibles } from '../components/TableauCibles'
import {
  anneeBudget, chargerBudgets, chargerParametres, consoliderBudgets, creerGroupe, enregistrerCiblesGroupe, enregistrerCiblesReseau, rangerMagasin,
  supprimerGroupe,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'

const RESEAU = 'reseau'

export function Hypotheses() {
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee)]).then(([d, p]) => ({ d, parametres: p.parametres })), [annee])
  const [onglet, setOnglet] = useState<string>(RESEAU)
  const [brouillons, setBrouillons] = useState<Record<string, Cibles>>({})
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [nouveau, setNouveau] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<number | null>(null)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    if (!donnees) return
    const { d } = donnees
    setBrouillons(Object.fromEntries([[RESEAU, d.reseau ?? {}], ...d.groupes.map((g) => [String(g.id), g.cibles ?? {}])]))
  }, [donnees])

  // Les familles proposées sont celles trouvées dans les prévisionnels importés
  const familles = useMemo(() => donnees?.d.magasins.flatMap((l) => l.base?.familles ?? []) ?? [], [donnees])

  if (chargement && !donnees) return <Box><Typography variant="h1">Hypothèses</Typography><Skeleton variant="rounded" height={240} sx={{ mt: 3 }} /></Box>
  if (erreur || !donnees) return <Box><Typography variant="h1" sx={{ mb: 3 }}>Hypothèses</Typography><Panne quoi="Les hypothèses" recharger={recharger} /></Box>

  const { d, parametres } = donnees
  const groupe = d.groupes.find((g) => String(g.id) === onglet) ?? null
  const ongletValide = onglet === RESEAU || groupe ? onglet : RESEAU
  const cibles = brouillons[ongletValide] ?? {}
  const enregistrees = ongletValide === RESEAU ? d.reseau ?? {} : groupe?.cibles ?? {}
  const modifie = JSON.stringify(cibles) !== JSON.stringify(enregistrees)
  const magasinsDuGroupe = groupe ? d.magasins.filter((l) => l.groupeId === groupe.id).map((l) => l.magasin) : d.magasins.map((l) => l.magasin)
  const apercu = consoliderBudgets({ ...d, reseau: ongletValide === RESEAU ? cibles : d.reseau, groupes: d.groupes.map((g) => (g.id === groupe?.id ? { ...g, cibles } : g)) }, parametres, magasinsDuGroupe)
  const nomGroupe = new Map(d.groupes.map((g) => [g.id, g.nom]))

  const agir = async (action: () => Promise<void>, reussite: string) => {
    setOccupe(true)
    setMessage(null)
    try {
      await action()
      setMessage({ gravite: 'success', texte: reussite })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Box>
      <Typography variant="h1">Hypothèses</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Budgets {annee}</Typography>

      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }} sx={{ mb: 2 }}>{message.texte}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={ongletValide} onChange={(_, v: string) => setOnglet(v)} variant="scrollable" scrollButtons="auto" aria-label="Niveaux des hypothèses" sx={{ flex: 1, minWidth: 0 }}>
          <Tab value={RESEAU} label="Réseau" sx={{ minHeight: 48 }} />
          {d.groupes.map((g) => <Tab key={g.id} value={String(g.id)} label={g.nom} sx={{ minHeight: 48 }} />)}
        </Tabs>
        <Button startIcon={<AddOutlined />} onClick={() => setNouveau('')} sx={{ minHeight: 48, flexShrink: 0 }}>Groupe</Button>
      </Box>

      <Stack spacing={3}>
        <Card sx={{ p: 2 }} component="section" aria-label="Effet des hypothèses">
          <Stack direction="row" useFlexGap spacing={4} sx={{ flexWrap: 'wrap' }}>
            <Box><Typography variant="body2" color="text.secondary">Magasins budgétés</Typography><Typography variant="h3" component="p">{apercu.n} / {magasinsDuGroupe.length}</Typography></Box>
            <Box><Typography variant="body2" color="text.secondary">CA HT {annee}</Typography><Typography variant="h3" component="p">{milliers(apercu.ca)}</Typography></Box>
            <Box><Typography variant="body2" color="text.secondary">EBE {annee}</Typography><Typography variant="h3" component="p">{milliers(apercu.ebe)}{apercu.ca ? ` · ${taux(apercu.ebe / apercu.ca)}` : ''}</Typography></Box>
          </Stack>
        </Card>

        {groupe && (
          <Card sx={{ p: 2 }} component="section" aria-label="Magasins du groupe">
            <Autocomplete
              multiple
              options={d.magasins.map((l) => l.magasin)}
              value={magasinsDuGroupe}
              disabled={occupe}
              getOptionLabel={(m) => m}
              renderOption={(props, m) => {
                const autre = d.magasins.find((l) => l.magasin === m)?.groupeId
                return <li {...props} key={m}>{m}{autre && autre !== groupe.id ? ` (${nomGroupe.get(autre)})` : ''}</li>
              }}
              onChange={(_, valeur) => {
                const ajoutes = valeur.filter((m) => !magasinsDuGroupe.includes(m))
                const retires = magasinsDuGroupe.filter((m) => !valeur.includes(m))
                void agir(async () => {
                  for (const m of ajoutes) await rangerMagasin(m, groupe.id)
                  for (const m of retires) await rangerMagasin(m, null)
                }, 'Magasins du groupe enregistrés.')
              }}
              renderInput={(p) => <TextField {...p} label={`Magasins du groupe ${groupe.nom}`} />}
              sx={{ '& .MuiInputBase-root': { minHeight: 56 } }}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setASupprimer(groupe.id)} sx={{ minHeight: 48 }}>Supprimer le groupe</Button>
            </Box>
          </Card>
        )}

        <Card component="section" aria-label={groupe ? `Cibles du groupe ${groupe.nom}` : 'Cibles du réseau'}>
          <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h2">{groupe ? `Cibles du groupe ${groupe.nom}` : 'Cibles du réseau'}</Typography>
            <Button variant="contained" startIcon={<SaveOutlined />} disabled={!modifie || occupe} sx={{ minHeight: 48 }}
              onClick={() => void agir(() => (groupe ? enregistrerCiblesGroupe(groupe.id, annee, cibles) : enregistrerCiblesReseau(annee, cibles)), 'Cibles enregistrées.')}>
              Enregistrer
            </Button>
          </Box>
          {familles.length === 0 && !groupe && (
            <Box sx={{ px: 2 }}><Alert severity="info">Les familles de produits apparaissent dès le premier prévisionnel importé.</Alert></Box>
          )}
          <TableContainer>
            <TableauCibles
              titre={groupe ? `Cibles du groupe ${groupe.nom}` : 'Cibles du réseau'}
              lignes={lignesCibles(familles, true)}
              niveau={groupe ? 'groupe' : 'reseau'}
              cibles={cibles}
              auDessus={groupe ? [{ niveau: 'reseau', cibles: d.reseau }] : []}
              onChange={(c) => setBrouillons((b) => ({ ...b, [ongletValide]: c }))}
            />
          </TableContainer>
        </Card>
        {d.magasins.length === 0 && <EtatVide titre="Aucun magasin rattaché à ton compte" texte="Les magasins sont tenus dans l’app du réseau." />}
      </Stack>

      <Dialog open={nouveau !== null} onClose={() => setNouveau(null)} fullWidth maxWidth="xs">
        <DialogTitle>Nouveau groupe</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Nom du groupe" value={nouveau ?? ''} onChange={(e) => setNouveau(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNouveau(null)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={!nouveau?.trim() || occupe} sx={{ minHeight: 48 }}
            onClick={() => {
              const nom = nouveau ?? ''
              setNouveau(null)
              void agir(async () => { setOnglet(String(await creerGroupe(nom))) }, `Groupe « ${nom.trim()} » créé.`)
            }}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={aSupprimer !== null} onClose={() => setASupprimer(null)}>
        <DialogTitle>Supprimer le groupe {aSupprimer ? nomGroupe.get(aSupprimer) : ''} ?</DialogTitle>
        <DialogContent>
          <Typography>Ses magasins reprennent les cibles du réseau. Leurs propres ajustements sont conservés.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setASupprimer(null)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button color="error" variant="contained" sx={{ minHeight: 48 }}
            onClick={() => {
              const id = aSupprimer
              setASupprimer(null)
              if (id !== null) void agir(async () => { await supprimerGroupe(id); setOnglet(RESEAU) }, 'Groupe supprimé.')
            }}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

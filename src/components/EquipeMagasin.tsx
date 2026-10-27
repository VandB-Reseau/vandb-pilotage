import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { enregistrerPersonne, supprimerPersonne } from '../data/pilotage'
import { milliers, montant, MOIS_LONGS, taux } from '../lib/format'
import { CATEGORIES, categorieLibelle, masseSalariale, type ParametresCharges, type Personne } from '../moteur/equipe'
import { champsDepuisPersonne, lirePersonne, nouvellePersonne, type ChampsPersonne } from '../moteur/saisieEquipe'

const nombreEtp = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const heures = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const select = { minWidth: 200, '& .MuiSelect-select': { minHeight: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }, '& .MuiSelect-nativeInput': { height: 48 } }

const nomMois = (m: string) => `${MOIS_LONGS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
function presence(p: Personne): string {
  if (p.entree && p.sortie) return `De ${nomMois(p.entree)} à ${nomMois(p.sortie)}`
  if (p.entree) return `Depuis ${nomMois(p.entree)}`
  if (p.sortie) return `Jusqu’à ${nomMois(p.sortie)}`
  return ''
}

// Équipe d'un magasin : une ligne par poste, coût chargé de l'année en cours et de l'année budgétée
export function EquipeMagasin({ magasin, equipe, annee, anneeBudget, hausse, charges, chargesBudget, peutSaisir, apresEnregistrement }: {
  magasin: string
  equipe: Personne[]
  annee: number
  anneeBudget: number
  hausse: number
  charges: ParametresCharges
  chargesBudget: ParametresCharges
  peutSaisir: boolean
  apresEnregistrement: () => void
}) {
  const [fiche, setFiche] = useState<ChampsPersonne | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [aRetirer, setARetirer] = useState<Personne | null>(null)
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [initiale, setInitiale] = useState('')
  useSaisieEnCours(!!fiche && JSON.stringify(fiche) !== initiale)

  const n = masseSalariale(equipe, charges, annee)
  const n1 = masseSalariale(equipe, chargesBudget, anneeBudget, hausse)
  const moisPossibles = [annee, anneeBudget].flatMap((a) => MOIS_LONGS.map((_, i) => `${a}-${String(i + 1).padStart(2, '0')}`))
  const ouvrir = (c: ChampsPersonne) => { setFiche(c); setInitiale(JSON.stringify(c)); setErreurs([]) }
  const changer = (c: Partial<ChampsPersonne>) => setFiche((f) => (f ? { ...f, ...c } : f))

  const agir = async (action: () => Promise<void>, reussite: string) => {
    setOccupe(true)
    try {
      await action()
      setMessage({ gravite: 'success', texte: reussite })
      apresEnregistrement()
      return true
    } catch {
      return false
    } finally {
      setOccupe(false)
    }
  }
  const enregistrer = async () => {
    if (!fiche) return
    const lu = lirePersonne(fiche)
    setErreurs(lu.erreurs)
    if (!lu.personne) return
    const p = lu.personne
    if (await agir(() => enregistrerPersonne(magasin, p), `${p.poste} enregistré dans l’équipe.`)) setFiche(null)
    else setErreurs(['L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.'])
  }
  const retirer = async (p: Personne) => {
    setARetirer(null)
    if (p.id && !(await agir(() => supprimerPersonne(p.id!), `${p.poste} retiré de l’équipe.`))) {
      setMessage({ gravite: 'error', texte: 'Le retrait n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    }
  }

  // Fiche d'un poste dans la page, sans fenêtre : sous la ligne modifiée, ou en bas du tableau pour un nouveau poste
  const formulaire = fiche && (
    <Box component="section" aria-labelledby="titre-poste" sx={{ p: { xs: 2, md: 2.5 }, bgcolor: 'background.default', borderRadius: 2 }}>
      <Typography variant="h3" component="h3" id="titre-poste" sx={{ mb: 2 }}>{fiche.id ? `Modifier ${fiche.poste}` : 'Nouveau poste'}</Typography>
      {erreurs.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erreurs.length === 1 ? erreurs[0] : <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{erreurs.map((t) => <li key={t}>{t}</li>)}</Box>}
        </Alert>
      )}
      <Stack spacing={2.5}>
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField label="Poste" value={fiche.poste} onChange={(e) => changer({ poste: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ minWidth: 200, bgcolor: 'background.paper' }} />
          <TextField select label="Catégorie" value={fiche.categorie} onChange={(e) => changer({ categorie: e.target.value as ChampsPersonne['categorie'] })} sx={{ ...select, bgcolor: 'background.paper' }}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ minHeight: 48 }}>{categorieLibelle[c]}</MenuItem>)}
          </TextField>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Heures par semaine</Typography>
            <ChampNombre libelle="Heures par semaine" valeur={fiche.heuresHebdo} unite="h" largeur={140} onChange={(v) => changer({ heuresHebdo: v })} />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{fiche.categorie === 'gerant_tns' ? 'Rémunération mensuelle' : 'Brut mensuel'}</Typography>
            <ChampNombre libelle={fiche.categorie === 'gerant_tns' ? 'Rémunération mensuelle' : 'Brut mensuel'} valeur={fiche.brutMensuel} largeur={180} onChange={(v) => changer({ brutMensuel: v })} />
          </Box>
        </Stack>
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
          <TextField select label="Arrivée" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={fiche.entree} onChange={(e) => changer({ entree: e.target.value })} sx={{ ...select, bgcolor: 'background.paper' }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Déjà dans l’équipe</MenuItem>
            {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{nomMois(m)}</MenuItem>)}
          </TextField>
          <TextField select label="Départ" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={fiche.sortie} onChange={(e) => changer({ sortie: e.target.value })} sx={{ ...select, bgcolor: 'background.paper' }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Pas de départ prévu</MenuItem>
            {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{nomMois(m)}</MenuItem>)}
          </TextField>
        </Stack>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Primes annuelles</Typography>
          <Stack spacing={1.5}>
            {fiche.primes.map((x, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField select label={`Mois de la prime ${i + 1}`} value={x.mois} sx={{ ...select, minWidth: 150, bgcolor: 'background.paper' }}
                  onChange={(e) => changer({ primes: fiche.primes.map((y, j) => (j === i ? { ...y, mois: Number(e.target.value) } : y)) })}>
                  {MOIS_LONGS.map((m, k) => <MenuItem key={m} value={k + 1} sx={{ minHeight: 48 }}>{m}</MenuItem>)}
                </TextField>
                <ChampNombre libelle={`Montant de la prime ${i + 1}`} valeur={x.montant} largeur={130}
                  onChange={(v) => changer({ primes: fiche.primes.map((y, j) => (j === i ? { ...y, montant: v } : y)) })} />
                <IconButton aria-label={`Retirer la prime ${i + 1}`} onClick={() => changer({ primes: fiche.primes.filter((_, j) => j !== i) })} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
              </Box>
            ))}
            <Box>
              <Button startIcon={<AddOutlined />} onClick={() => changer({ primes: [...fiche.primes, { mois: 12, montant: '' }] })} sx={{ minHeight: 48 }}>Prime</Button>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button onClick={() => setFiche(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" onClick={() => void enregistrer()} disabled={occupe} sx={{ minHeight: 48 }}>Enregistrer</Button>
        </Box>
      </Stack>
    </Box>
  )
  const ligneFormulaire = (cle: string) => (
    <TableRow key={cle}>
      <TableCell colSpan={peutSaisir ? 10 : 9} sx={{ p: 1.5, position: 'static !important', boxShadow: 'none !important' }}>{formulaire}</TableCell>
    </TableRow>
  )

  const boutonAjout = peutSaisir && (
    <Button variant={equipe.length ? 'outlined' : 'contained'} startIcon={<PersonAddAltOutlined />} sx={{ minHeight: 48 }} onClick={() => ouvrir(nouvellePersonne(equipe))}>
      Ajouter un poste
    </Button>
  )

  return (
    <Stack spacing={3}>
      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>}

      {equipe.length === 0 && fiche ? (
        <Card sx={{ p: 1 }}>{formulaire}</Card>
      ) : equipe.length === 0 ? (
        <EtatVide
          titre="Pas encore d’équipe"
          texte={peutSaisir ? 'Chaque poste, avec ses heures et son salaire, fait la masse salariale du budget.' : 'L’équipe de ce magasin n’est pas encore renseignée.'}
          action={boutonAjout || undefined}
        />
      ) : (
        <>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Masse salariale en chiffres">
            <Indicateur libelle={`Masse salariale chargée ${annee}`} valeur={milliers(n.cout)} detail={`Brut : ${milliers(n.brut)}`} />
            <Indicateur libelle={`Masse salariale chargée ${anneeBudget}`} valeur={milliers(n1.cout)} detail={`Hausse des salaires : ${taux(hausse)}`} />
            <Indicateur libelle="Équivalents temps plein" valeur={nombreEtp.format(n.etp)} detail={`${equipe.length} poste${equipe.length > 1 ? 's' : ''}`} />
            <Indicateur libelle="Charges patronales" valeur={taux(n.tauxEffectif)} detail={`Réduction générale : ${milliers(n.reduction)}`} />
          </Stack>
          {boutonAjout && <Box>{boutonAjout}</Box>}

          <Card component="section" aria-label="Équipe du magasin">
            <Typography variant="h2" sx={{ p: 2, pb: 0 }}>Équipe</Typography>
            <TableContainer>
              <Table className="colonne-fixe" aria-label="Postes et coût chargé">
                <TableHead>
                  <TableRow>
                    <TableCell>Poste</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Heures par semaine</TableCell>
                    <TableCell align="right">Brut mensuel</TableCell>
                    <TableCell align="right">Primes</TableCell>
                    <TableCell>Présence</TableCell>
                    <TableCell align="right">Charges</TableCell>
                    <TableCell align="right">Coût {annee}</TableCell>
                    <TableCell align="right">Coût {anneeBudget}</TableCell>
                    {peutSaisir && <TableCell align="right"><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</Box></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {n.personnes.map((x, i) => {
                    const p = x.personne
                    const primes = p.primes.reduce((a, y) => a + y.montant, 0)
                    return [
                      <TableRow key={p.id ?? i}>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{p.poste}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{categorieLibelle[p.categorie]}</TableCell>
                        <TableCell align="right">{heures.format(p.heuresHebdo)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{montant(p.brutMensuel)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{primes ? montant(primes) : ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{presence(p)}</TableCell>
                        <TableCell align="right">{taux(x.tauxEffectif)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{montant(x.coutAnnuel)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{montant(n1.personnes[i].coutAnnuel)}</TableCell>
                        {peutSaisir && (
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton aria-label={`Modifier ${p.poste}`} onClick={() => ouvrir(champsDepuisPersonne(p))} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton>
                            <IconButton aria-label={`Retirer ${p.poste}`} onClick={() => setARetirer(p)} disabled={occupe} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                          </TableCell>
                        )}
                      </TableRow>,
                      fiche?.id && fiche.id === p.id ? ligneFormulaire(`fiche-${p.id}`) : null,
                    ]
                  })}
                  {fiche && !fiche.id && ligneFormulaire('fiche-nouveau')}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell colSpan={6} />
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{montant(n.cout)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{montant(n1.cout)}</TableCell>
                    {peutSaisir && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      <Dialog open={!!aRetirer} onClose={() => setARetirer(null)}>
        <DialogTitle>Retirer {aRetirer?.poste} de l’équipe ?</DialogTitle>
        <DialogContent><Typography>Pour un départ prévu, indique plutôt son mois de départ : le budget en tiendra compte.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setARetirer(null)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button color="error" variant="contained" onClick={() => aRetirer && void retirer(aRetirer)} sx={{ minHeight: 48 }}>Retirer</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

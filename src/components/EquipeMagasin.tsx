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
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined'
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined'
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined'
import RedeemOutlined from '@mui/icons-material/RedeemOutlined'
import { Aide } from './Aide'
import { BarreEnregistrement } from './BarreEnregistrement'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { enregistrerPersonne, supprimerPersonne } from '../data/pilotage'
import { nombreChangements } from '../lib/aFaire'
import { milliers, montant, MOIS, MOIS_LONGS, panier, taux } from '../lib/format'
import { changementsEquipe, type ChangementEquipe } from '../moteur/changementsEquipe'
import { ebeApres } from '../moteur/effets'
import { CATEGORIES, categorieLibelle, masseSalariale, SEMAINES_PAR_MOIS, type ParametresCharges, type Personne } from '../moteur/equipe'
import { champsDepuisPersonne, lirePersonne, nouveauxExtras, nouvellePersonne, nouvellesPrimesEquipe, type ChampsPersonne } from '../moteur/saisieEquipe'
import { nombre } from '../import/caisse'
import { styleTableau } from '../theme/tableau'

const nombreEtp = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const heures = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const select = { minWidth: 200, '& .MuiSelect-select': { minHeight: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }, '& .MuiSelect-nativeInput': { height: 48 } }

// Valeur saisie convertie quand on change d'unité : 35 h par semaine ↔ 151,67 h par mois
function convertir(texte: string, vers: 'semaine' | 'mois'): string {
  const v = nombre(texte)
  if (v === null || Number.isNaN(v)) return texte
  const r = vers === 'mois' ? v * SEMAINES_PAR_MOIS : v / SEMAINES_PAR_MOIS
  return String(Math.round(r * 100) / 100).replace('.', ',')
}

const nomMois = (m: string) => `${MOIS_LONGS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
function presence(p: Personne): string {
  if (p.enveloppe) return 'Sans salarié'
  if (p.entree && p.sortie) return `De ${nomMois(p.entree)} à ${nomMois(p.sortie)}`
  if (p.entree) return `Depuis ${nomMois(p.entree)}`
  if (p.sortie) return `Jusqu’à ${nomMois(p.sortie)}`
  return ''
}

// Équipe d'un magasin : une ligne par poste, coût chargé de l'année en cours et de l'année budgétée
const parHeure = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const heuresDe = (p: Personne) => (p.enveloppe ? '–' : p.heuresSaisie === 'mois' ? `${heures.format(p.heuresHebdo * SEMAINES_PAR_MOIS)} h par mois` : `${heures.format(p.heuresHebdo)} h par semaine`)

export function EquipeMagasin({ magasin, equipe, annee, anneeBudget, hausse, charges, chargesBudget, peutSaisir, apresEnregistrement, caAnnee, caBudget, ebeBudget }: {
  magasin: string
  equipe: Personne[]
  annee: number
  anneeBudget: number
  hausse: number
  charges: ParametresCharges
  chargesBudget: ParametresCharges
  peutSaisir: boolean
  apresEnregistrement: () => void
  caAnnee?: number     // CA HT atterri de l'année en cours, pour la productivité
  caBudget?: number    // CA HT du budget
  ebeBudget?: number   // EBE du budget, pour l'effet de la saisie (lot 28)
}) {
  const [fiche, setFiche] = useState<ChampsPersonne | null>(null)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [aRetirer, setARetirer] = useState<Personne | null>(null)
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [initiale, setInitiale] = useState('')
  const [menu, setMenu] = useState<{ ancre: HTMLElement; quoi: 'choix' | 'hausse' | 'depart' } | null>(null)
  const ficheModifiee = !!fiche && JSON.stringify(fiche) !== initiale
  useSaisieEnCours(ficheModifiee)

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
    if (await agir(() => enregistrerPersonne(magasin, p), p.enveloppe ? `${p.poste} : primes enregistrées dans l’équipe.` : p.tauxHoraire ? `${p.poste} : extras enregistrés dans l’équipe.` : `${p.poste} enregistré dans l’équipe.`)) setFiche(null)
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
      <Typography variant="h3" component="h3" id="titre-poste" sx={{ mb: 2 }}>{fiche.id ? `Modifier ${fiche.poste}` : fiche.enveloppe ? 'Primes d’équipe' : fiche.extra ? 'Extras' : 'Nouveau poste'}{fiche.extra && <Aide sujet="extras" />}</Typography>
      {erreurs.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erreurs.length === 1 ? erreurs[0] : <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{erreurs.map((t) => <li key={t}>{t}</li>)}</Box>}
        </Alert>
      )}
      <Stack spacing={2.5}>
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField label={fiche.enveloppe || fiche.extra ? 'Nom' : 'Poste'} value={fiche.poste} onChange={(e) => changer({ poste: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ minWidth: 200, bgcolor: 'background.paper' }} />
          <TextField select label={fiche.enveloppe ? 'Catégorie des bénéficiaires' : 'Catégorie'} value={fiche.categorie} onChange={(e) => changer({ categorie: e.target.value as ChampsPersonne['categorie'] })} sx={{ ...select, bgcolor: 'background.paper' }}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ minHeight: 48 }}>{categorieLibelle[c]}</MenuItem>)}
          </TextField>
          {!fiche.enveloppe && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Heures</Typography>
                <ToggleButtonGroup exclusive size="small" value={fiche.heuresSaisie} aria-label="Heures saisies"
                  onChange={(_, u: 'semaine' | 'mois' | null) => u && u !== fiche.heuresSaisie && changer({ heuresSaisie: u, heures: convertir(fiche.heures, u) })}>
                  <ToggleButton value="semaine" sx={{ minHeight: { xs: 48, md: 32 }, px: 1.25 }}>Par semaine</ToggleButton>
                  <ToggleButton value="mois" sx={{ minHeight: { xs: 48, md: 32 }, px: 1.25 }}>Par mois</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <ChampNombre libelle={`${fiche.extra ? 'Heures d’extras' : 'Heures'} par ${fiche.heuresSaisie}`} valeur={fiche.heures} unite="h" largeur={140} onChange={(v) => changer({ heures: v })} />
            </Box>
          )}
          {fiche.extra && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Taux horaire brut</Typography>
              <ChampNombre libelle="Taux horaire brut" valeur={fiche.tauxHoraire} unite="€ par heure" largeur={170} onChange={(v) => changer({ tauxHoraire: v })} />
            </Box>
          )}
          {!fiche.enveloppe && !fiche.extra && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{fiche.categorie === 'gerant_tns' ? 'Rémunération mensuelle' : 'Brut mensuel'}</Typography>
              <ChampNombre libelle={fiche.categorie === 'gerant_tns' ? 'Rémunération mensuelle' : 'Brut mensuel'} valeur={fiche.brutMensuel} largeur={180} onChange={(v) => changer({ brutMensuel: v })} />
            </Box>
          )}
        </Stack>
        {!fiche.enveloppe && <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }}>
          <TextField select label="Arrivée" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={fiche.entree} onChange={(e) => changer({ entree: e.target.value })} sx={{ ...select, bgcolor: 'background.paper' }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Déjà dans l’équipe</MenuItem>
            {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{nomMois(m)}</MenuItem>)}
          </TextField>
          <TextField select label="Départ" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={fiche.sortie} onChange={(e) => changer({ sortie: e.target.value })} sx={{ ...select, bgcolor: 'background.paper' }}>
            <MenuItem value="" sx={{ minHeight: 48 }}>Pas de départ prévu</MenuItem>
            {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{nomMois(m)}</MenuItem>)}
          </TextField>
        </Stack>}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{fiche.enveloppe ? 'Primes versées à l’équipe' : 'Primes annuelles'}</Typography>
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
        {!fiche.enveloppe && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Hausses de salaire</Typography>
            <Stack spacing={1.5}>
              {fiche.hausses.map((x, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField select label={`Mois de la hausse ${i + 1}`} value={x.mois} sx={{ ...select, minWidth: 180, bgcolor: 'background.paper' }}
                    onChange={(e) => changer({ hausses: fiche.hausses.map((y, j) => (j === i ? { ...y, mois: e.target.value } : y)) })}>
                    {moisPossibles.map((m) => <MenuItem key={m} value={m} sx={{ minHeight: 48 }}>{nomMois(m)}</MenuItem>)}
                  </TextField>
                  <ChampNombre libelle={`Hausse ${i + 1} en %`} valeur={x.taux} unite="%" largeur={120}
                    onChange={(v) => changer({ hausses: fiche.hausses.map((y, j) => (j === i ? { ...y, taux: v } : y)) })} />
                  <IconButton aria-label={`Retirer la hausse ${i + 1}`} onClick={() => changer({ hausses: fiche.hausses.filter((_, j) => j !== i) })} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                </Box>
              ))}
              <Box>
                <Button startIcon={<AddOutlined />} onClick={() => changer({ hausses: [...fiche.hausses, { mois: `${anneeBudget}-01`, taux: '' }] })} sx={{ minHeight: 48 }}>Hausse de salaire</Button>
              </Box>
            </Stack>
          </Box>
        )}
        {/* Enregistrer : dans la barre du bas, avec l'effet sur la masse salariale et l'EBE (lot 28) */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button onClick={() => setFiche(null)} disabled={occupe} sx={{ minHeight: 48 }}>{ficheModifiee ? 'Fermer sans enregistrer' : 'Fermer'}</Button>
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
    <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap' }}>
      <Button variant={equipe.length ? 'outlined' : 'contained'} startIcon={<PersonAddAltOutlined />} sx={{ minHeight: 48 }} onClick={() => ouvrir(nouvellePersonne(equipe))}>
        Ajouter un poste
      </Button>
      <Button variant="outlined" startIcon={<RedeemOutlined />} sx={{ minHeight: 48 }} onClick={() => ouvrir(nouvellesPrimesEquipe())}>
        Primes d’équipe
      </Button>
      <Button variant="outlined" startIcon={<GroupAddOutlined />} sx={{ minHeight: 48 }} onClick={() => ouvrir(nouveauxExtras())}>
        Extras
      </Button>
    </Stack>
  )
  // Productivité : CA HT par heure travaillée sur l'année
  const heuresAn = (m: ReturnType<typeof masseSalariale>) => m.parMois.reduce((a, x) => a + x.heures, 0)
  const productivite = (ca: number | undefined, m: ReturnType<typeof masseSalariale>) => (ca && heuresAn(m) > 0 ? ca / heuresAn(m) : null)
  const prodN = productivite(caAnnee, n), prodN1 = productivite(caBudget, n1)
  // Effet de la fiche en cours sur l'année du budget : le poste modifié remplace l'ancien, un nouveau s'ajoute
  const apercu = fiche ? lirePersonne(fiche).personne : null
  const apres = apercu ? masseSalariale([...equipe.filter((p) => !apercu.id || p.id !== apercu.id), apercu], chargesBudget, anneeBudget, hausse) : null
  // Un nouveau poste est un changement en soi : la barre est là dès l'ouverture de sa fiche
  const barre = peutSaisir && fiche && (ficheModifiee || !fiche.id) && (
    <BarreEnregistrement
      changements={Math.max(fiche.id ? 0 : 1, nombreChangements(JSON.parse(initiale), fiche))} occupe={occupe}
      libelle={fiche.enveloppe ? 'Enregistrer les primes' : 'Enregistrer le poste'}
      onAnnuler={() => setFiche(null)} onEnregistrer={() => void enregistrer()}
      effets={apres ? [
        { libelle: `Masse salariale ${anneeBudget}`, avant: milliers(n1.cout), apres: milliers(apres.cout) },
        ...(ebeBudget !== undefined ? [{ libelle: `EBE ${anneeBudget}`, avant: milliers(ebeBudget), apres: milliers(ebeApres(ebeBudget, n1.cout, apres.cout)) }] : []),
      ] : []}
    />
  )

  // Lot 35 (Joseph, 02/11/2026) : l'année du budget racontée par ses changements, et la masse salariale mois par mois
  const changements = changementsEquipe(equipe, chargesBudget, anneeBudget, hausse)
  const quoi = (c: ChangementEquipe) => ({
    hausse_generale: `Hausse générale des salaires : ${taux(c.taux ?? 0)}`,
    hausse: `${c.poste} : hausse de ${taux(c.taux ?? 0)}`,
    arrivee: `Arrivée : ${c.poste}`,
    depart: `Départ : ${c.poste} (dernier mois)`,
    prime: `Prime : ${c.poste} (${montant(c.montant ?? 0)} brut)`,
  })[c.type]
  const salaries = equipe.filter((p) => !p.enveloppe)
  const choisir = (quoiFaire: 'hausse' | 'depart', p: Personne) => {
    setMenu(null)
    const c = champsDepuisPersonne(p)
    ouvrir(c)
    if (quoiFaire === 'hausse') setFiche({ ...c, hausses: [...c.hausses, { mois: `${anneeBudget}-01`, taux: '' }] })
    else if (!c.sortie) setFiche({ ...c, sortie: `${anneeBudget}-12` })
  }
  const maxMois = Math.max(1, ...n1.parMois.map((m) => m.cout))
  const moisChange = new Set(changements.map((c) => c.mois))
  const carteChangements = equipe.length > 0 && (
    <Card component="section" aria-label={`Changements prévus en ${anneeBudget}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Changements prévus en {anneeBudget}<Aide sujet="changementsEquipe" /></Typography>
        {peutSaisir && (
          <Button variant="outlined" startIcon={<EventNoteOutlined />} onClick={(e) => setMenu({ ancre: e.currentTarget, quoi: 'choix' })} sx={{ minHeight: 48 }}>
            Ajouter un changement
          </Button>
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 2, alignItems: 'start' }}>
        <TableContainer sx={{ minWidth: 0 }}>
          <Table size="small" aria-label={`Changements de l’équipe en ${anneeBudget}`} sx={{ ...styleTableau, '& td, & th': { ...styleTableau['& td, & th'], fontSize: '0.875rem', whiteSpace: 'normal' } }}>
            <TableHead>
              <TableRow><TableCell>Mois</TableCell><TableCell>Changement</TableCell><TableCell align="right">Effet sur l’année</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {changements.length === 0 && (
                <TableRow><TableCell colSpan={3} sx={{ color: 'text.secondary' }}>Aucun changement prévu : l’équipe {anneeBudget} reste celle d’aujourd’hui.</TableCell></TableRow>
              )}
              {changements.map((c, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap !important' }}>{MOIS_LONGS[c.mois - 1]}</TableCell>
                  <TableCell>{quoi(c)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap !important', color: c.effet < 0 ? 'success.main' : 'text.primary' }}>{`${c.effet > 0 ? '+' : ''}${montant(c.effet)}`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ px: 2.5, pb: 2 }} role="img" aria-label={`Masse salariale chargée par mois en ${anneeBudget} : de ${milliers(Math.min(...n1.parMois.map((m) => m.cout)))} à ${milliers(maxMois)}`}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Masse salariale chargée par mois</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120 }}>
            {n1.parMois.map((m, i) => (
              <Box key={i} title={`${MOIS_LONGS[i]} : ${montant(m.cout)}`} sx={{ flex: 1, height: `${Math.max(2, (m.cout / maxMois) * 100)}%`, borderRadius: '3px 3px 0 0', bgcolor: moisChange.has(i + 1) ? 'secondary.main' : 'primary.main', opacity: 0.85 }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {MOIS.map((m) => <Typography key={m} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center', fontSize: 12, overflow: 'hidden' }}>{m.charAt(0)}</Typography>)}
          </Box>
        </Box>
      </Box>
      <Menu anchorEl={menu?.ancre} open={!!menu} onClose={() => setMenu(null)}>
        {menu?.quoi === 'choix' && [
          salaries.length > 0 && <MenuItem key="h" sx={{ minHeight: 48 }} onClick={() => setMenu({ ...menu, quoi: 'hausse' })}>Hausse de salaire d’un poste…</MenuItem>,
          <MenuItem key="a" sx={{ minHeight: 48 }} onClick={() => { setMenu(null); ouvrir({ ...nouvellePersonne(equipe), entree: `${anneeBudget}-01` }) }}>Arrivée d’un poste</MenuItem>,
          salaries.length > 0 && <MenuItem key="d" sx={{ minHeight: 48 }} onClick={() => setMenu({ ...menu, quoi: 'depart' })}>Départ d’un poste…</MenuItem>,
          <MenuItem key="p" sx={{ minHeight: 48 }} onClick={() => { setMenu(null); ouvrir(nouvellesPrimesEquipe()) }}>Primes d’équipe</MenuItem>,
        ]}
        {(menu?.quoi === 'hausse' || menu?.quoi === 'depart') && salaries.map((p) => (
          <MenuItem key={p.id ?? p.poste} sx={{ minHeight: 48 }} onClick={() => choisir(menu.quoi as 'hausse' | 'depart', p)}>{p.poste}</MenuItem>
        ))}
      </Menu>
    </Card>
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
            <Indicateur libelle={`Masse salariale chargée ${annee}`} aide="masseChargee" valeur={milliers(n.cout)} detail={`Brut : ${milliers(n.brut)}`} />
            <Indicateur libelle={`Masse salariale chargée ${anneeBudget}`} aide="masseChargee" valeur={milliers(n1.cout)} detail={`Hausse des salaires : ${taux(hausse)}`} />
            <Indicateur libelle="Équivalents temps plein" aide="etp" valeur={nombreEtp.format(n.etp)} detail={`${equipe.length} poste${equipe.length > 1 ? 's' : ''}`} />
            <Indicateur libelle="Charges patronales" aide="chargesPatronales" valeur={taux(n.tauxEffectif)} detail={`Réduction générale : ${milliers(n.reduction)}`} />
            {(prodN1 !== null || prodN !== null) && (
              <Indicateur aide="productivite" libelle={`Productivité ${prodN1 !== null ? anneeBudget : annee}`} valeur={`${parHeure.format((prodN1 ?? prodN)!)} par heure`}
                detail={`CA HT par heure travaillée${prodN1 !== null && prodN !== null ? ` · ${annee} : ${parHeure.format(prodN)}` : ''} · ${heures.format(heuresAn(prodN1 !== null ? n1 : n))} h`} />
            )}
          </Stack>
          {boutonAjout && <Box>{boutonAjout}</Box>}

          <Card component="section" aria-label="Équipe du magasin">
            <Typography variant="h2" sx={{ p: 2, pb: 0 }}>Équipe</Typography>
            <TableContainer>
              <Table size="small" className="colonne-fixe" aria-label="Postes et coût chargé" sx={styleTableau}>
                <TableHead>
                  <TableRow>
                    <TableCell>Poste</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Heures</TableCell>
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
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{heuresDe(p)}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{p.enveloppe ? '–' : p.tauxHoraire ? `${montant(p.brutMensuel)} (${panier(p.tauxHoraire)} de l’heure)` : montant(p.brutMensuel)}</TableCell>
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
          {carteChangements}
        </>
      )}

      {barre}

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

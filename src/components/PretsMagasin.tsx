import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
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
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Aide } from './Aide'
import { ChampMontant } from './ChampMontant'
import { ChampTaux } from './ChampTaux'
import { ChoixListe } from './ChoixListe'
import { useSaisieEnCours } from './GardeSaisie'
import { enregistrerPret, supprimerPret } from '../data/pilotage'
import { MOIS_LONGS, montant, panier, taux } from '../lib/format'
import { finPret, mensualitePret, pretsDeLAnnee, pretValide, restantDu } from '../moteur/financement'
import type { Pret } from '../moteur/types'
import { styleTableau } from '../theme/tableau'

// Prêts du magasin (Joseph, 03/11/2026) : saisis une fois, comme l'équipe, avec la date de leur 1re échéance ;
// l'échéancier donne les intérêts et le capital de chaque année. Enregistrés aussitôt, hors du brouillon du budget.
const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const sx = { ...styleTableau, '& td, & th': { px: 0.75, whiteSpace: 'nowrap' }, '& th': { whiteSpace: 'normal', verticalAlign: 'bottom' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }
const enMois = (aaaamm: string | null) => {
  if (!aaaamm) return '—'
  const [a, m] = aaaamm.split('-').map(Number)
  return `${MOIS_LONGS[m - 1]} ${a}`
}

function nouveauPret(annee: number): Pret {
  return { libelle: '', mode: 'initial', montant: 0, taux: 0.04, duree: 7, debut: `${annee}-01`, differe: 0, mensualite: 0 }
}

// Ce qui manque pour que le prêt se calcule, en clair
function erreursPret(p: Pret): string[] {
  const e: string[] = []
  if (!(p.montant > 0)) e.push(p.mode === 'initial' ? 'Indique le montant emprunté.' : 'Indique le capital restant dû.')
  if (p.mode === 'initial') {
    if (!(p.duree > 0)) e.push('Indique la durée du prêt en années.')
    else if ((p.differe ?? 0) >= p.duree * 12) e.push('Le différé doit être plus court que le prêt.')
  } else if (p.montant > 0 && !((p.mensualite ?? 0) > p.montant * p.taux / 12)) {
    e.push(`La mensualité doit couvrir plus que les intérêts du mois (${montant(p.montant * p.taux / 12)}).`)
  }
  return e
}

export function PretsMagasin({ magasin, prets, annee, peutSaisir, apresEnregistrement }: {
  magasin: string
  prets: Pret[]
  annee: number          // année du budget
  peutSaisir: boolean
  apresEnregistrement: () => void
}) {
  const [fiche, setFiche] = useState<Pret | null>(null)
  const [initiale, setInitiale] = useState('')
  const [erreurs, setErreurs] = useState<string[]>([])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [aRetirer, setARetirer] = useState<number | null>(null)
  const [occupe, setOccupe] = useState(false)
  const modifiee = !!fiche && JSON.stringify(fiche) !== initiale
  useSaisieEnCours(modifiee)

  const ouvrir = (p: Pret) => { setFiche(p); setInitiale(JSON.stringify(p)); setErreurs([]); setMessage(null) }
  const changer = (x: Partial<Pret>) => setFiche((f) => (f ? { ...f, ...x } : f))
  const annees = Array.from({ length: 24 }, (_, i) => annee + 3 - i).map((a) => ({ valeur: a, libelle: String(a) }))

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
    const e = erreursPret(fiche)
    setErreurs(e)
    if (e.length || !pretValide(fiche)) return
    const nom = fiche.libelle.trim() || 'Prêt'
    if (await agir(() => enregistrerPret(magasin, fiche), `${nom} enregistré.`)) setFiche(null)
    else setErreurs(['L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.'])
  }
  const retirer = async (p: Pret) => {
    setARetirer(null)
    if (p.id && !(await agir(() => supprimerPret(p.id!), `${p.libelle} retiré.`))) {
      setMessage({ gravite: 'error', texte: 'Le retrait n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    }
  }

  const [anneeDebut, moisDebut] = (fiche?.debut ?? `${annee}-01`).split('-').map(Number)
  const ecrireDebut = (a: number, m: number) => changer({ debut: `${a}-${String(m).padStart(2, '0')}` })
  const apercu = fiche && pretValide(fiche) ? pretsDeLAnnee([fiche], annee) : null
  const formulaire = fiche && (
    <Box component="section" aria-labelledby="titre-pret" sx={{ p: { xs: 2, md: 2.5 }, bgcolor: 'background.default', borderRadius: 2 }}>
      <Typography variant="h3" component="h3" id="titre-pret" sx={{ mb: 2 }}>{fiche.id ? `Modifier ${fiche.libelle}` : 'Nouveau prêt'}</Typography>
      {erreurs.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erreurs.length === 1 ? erreurs[0] : <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{erreurs.map((t) => <li key={t}>{t}</li>)}</Box>}
        </Alert>
      )}
      <Stack spacing={2.5}>
        <ToggleButtonGroup exclusive size="small" value={fiche.mode} aria-label="Saisie du prêt" sx={{ flexWrap: 'wrap', bgcolor: 'background.paper', alignSelf: 'flex-start' }}
          onChange={(_, m: Pret['mode'] | null) => m && changer({ mode: m })}>
          <ToggleButton value="initial" sx={{ minHeight: 48, px: 2 }}>D’après le tableau de la banque</ToggleButton>
          <ToggleButton value="restant" sx={{ minHeight: 48, px: 2 }}>Capital restant dû</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField label="Nom du prêt" value={fiche.libelle} placeholder="Prêt bancaire travaux" onChange={(e) => changer({ libelle: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 80 }, inputLabel: { shrink: true } }} sx={{ minWidth: 220, bgcolor: 'background.paper' }} />
          <ChampMontant libelle={fiche.mode === 'initial' ? 'Montant emprunté' : 'Capital restant dû'} valeur={fiche.montant} largeur={170} onChange={(v) => changer({ montant: Math.max(0, v) })} />
          <ChampTaux libelle="Taux annuel" valeur={fiche.taux} heritee={0} largeur={120} onChange={(v) => changer({ taux: Math.max(0, v ?? 0) })} />
          {fiche.mode === 'initial' ? (
            <>
              <ChampMontant libelle="Durée" valeur={fiche.duree} unite="ans" largeur={110} onChange={(v) => changer({ duree: Math.max(0, v) })} />
              <ChampMontant libelle="Différé" valeur={fiche.differe ?? 0} unite="mois" largeur={110} onChange={(v) => changer({ differe: Math.max(0, Math.round(v)) })} />
            </>
          ) : (
            <ChampMontant libelle="Mensualité" valeur={fiche.mensualite ?? 0} unite="€ par mois" largeur={170} onChange={(v) => changer({ mensualite: Math.max(0, v) })} />
          )}
        </Stack>
        <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ minWidth: 150 }}>{fiche.mode === 'initial' ? '1re échéance' : 'Prochaine échéance'}</Typography>
          <ChoixListe libelle={fiche.mode === 'initial' ? 'Mois de la 1re échéance' : 'Mois de la prochaine échéance'} valeur={moisDebut} options={MOIS_OPTIONS} largeur={140} onChange={(m) => ecrireDebut(anneeDebut, m)} />
          <ChoixListe libelle={fiche.mode === 'initial' ? 'Année de la 1re échéance' : 'Année de la prochaine échéance'} valeur={anneeDebut} options={annees} largeur={110} onChange={(a) => ecrireDebut(a, moisDebut)} />
        </Stack>
        {apercu && (
          <Typography aria-live="polite" sx={{ color: 'text.secondary' }}>
            {`${panier(mensualitePret(fiche))} par mois${fiche.mode === 'initial' && fiche.differe ? ` après ${fiche.differe} mois d’intérêts seuls` : ''}, dernière échéance en ${enMois(finPret(fiche))}. En ${annee} : ${montant(apercu.enCours.interets + apercu.nouveaux.interets)} d’intérêts, ${montant(apercu.enCours.capital + apercu.nouveaux.capital)} de capital.`}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button onClick={() => setFiche(null)} disabled={occupe} sx={{ minHeight: 48 }}>{modifiee ? 'Fermer sans enregistrer' : 'Fermer'}</Button>
          <Button variant="contained" onClick={() => void enregistrer()} disabled={occupe || (!!fiche.id && !modifiee)} sx={{ minHeight: 48 }}>Enregistrer le prêt</Button>
        </Box>
      </Stack>
    </Box>
  )
  const ligneFormulaire = (cle: string) => (
    <TableRow key={cle}>
      <TableCell colSpan={7} sx={{ p: 1.5 }}>{formulaire}</TableCell>
    </TableRow>
  )

  const total = pretsDeLAnnee(prets, annee)
  return (
    <Box component="section" aria-label="Prêts du magasin">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, pt: 1, pb: 1 }}>
        <Typography variant="h3" component="h3">Prêts du magasin</Typography><Aide sujet="prets" />
      </Box>
      {message && <Alert severity={message.gravite} sx={{ mx: 2.5, mb: 1.5 }}>{message.texte}</Alert>}
      {prets.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label={`Prêts du magasin en ${annee}`} sx={sx}>
            <TableHead>
              <TableRow>
                <TableCell>Prêt</TableCell>
                <TableCell align="right" sx={{ maxWidth: 130 }}>{`Restant dû au 1er janvier ${annee}`}</TableCell>
                <TableCell align="right">Mensualité</TableCell>
                <TableCell sx={{ maxWidth: 100 }}>Dernière échéance</TableCell>
                <TableCell align="right">{`Intérêts ${annee}`}</TableCell>
                <TableCell align="right">{`Capital ${annee}`}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {prets.flatMap((p) => {
                const a = pretsDeLAnnee([p], annee)
                const nouveau = a.nouveaux.montant > 0
                const ligne = (
                  <TableRow key={p.id ?? p.libelle}>
                    <TableCell sx={{ whiteSpace: 'normal', minWidth: 160 }}>
                      <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>{p.libelle}</Box>
                      <Box component="span" sx={{ display: 'block', fontSize: '0.8125rem', color: 'text.secondary' }}>
                        {nouveau ? `Nouveau : ${montant(a.nouveaux.montant)}, 1re échéance en ${enMois(p.debut)}`
                          : p.mode === 'initial' ? `${montant(p.montant)} empruntés à ${taux(p.taux)}` : 'Saisi par son capital restant dû'}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{nouveau ? '—' : montant(restantDu(p, annee))}</TableCell>
                    <TableCell align="right">{panier(mensualitePret(p))}</TableCell>
                    <TableCell>{enMois(finPret(p))}</TableCell>
                    <TableCell align="right">{montant(a.enCours.interets + a.nouveaux.interets)}</TableCell>
                    <TableCell align="right">{montant(a.enCours.capital + a.nouveaux.capital)}</TableCell>
                    <TableCell align="right" sx={{ width: 96 }}>
                      {peutSaisir && aRetirer === p.id ? (
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          <Button color="error" onClick={() => void retirer(p)} disabled={occupe} sx={{ minHeight: 48 }}>{`Retirer ${p.libelle}`}</Button>
                          <Button onClick={() => setARetirer(null)} sx={{ minHeight: 48 }}>Garder</Button>
                        </Box>
                      ) : peutSaisir && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Modifier"><IconButton aria-label={`Modifier ${p.libelle}`} onClick={() => ouvrir({ ...p })} sx={{ width: 48, height: 48 }}><EditOutlined /></IconButton></Tooltip>
                          <Tooltip title="Retirer"><IconButton aria-label={`Retirer ${p.libelle}`} onClick={() => setARetirer(p.id ?? null)} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton></Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                )
                return fiche?.id && fiche.id === p.id ? [ligne, ligneFormulaire(`fiche-${p.id}`)] : [ligne]
              })}
              {prets.length > 1 && (
                <TableRow sx={{ '& td': { fontWeight: 700 } }}>
                  <TableCell>Total</TableCell>
                  <TableCell align="right">{montant(prets.reduce((s, p) => s + (pretsDeLAnnee([p], annee).nouveaux.montant ? 0 : restantDu(p, annee)), 0))}</TableCell>
                  <TableCell align="right">{panier(prets.reduce((s, p) => s + mensualitePret(p), 0))}</TableCell>
                  <TableCell />
                  <TableCell align="right">{montant(total.enCours.interets + total.nouveaux.interets)}</TableCell>
                  <TableCell align="right">{montant(total.enCours.capital + total.nouveaux.capital)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!prets.length && !fiche && (
        <Typography sx={{ px: 2.5, pb: 1, color: 'text.secondary' }}>
          {peutSaisir ? 'Aucun prêt saisi. Ajoute chaque prêt du magasin avec la date de sa 1re échéance : ses intérêts et son capital se calculent pour chaque année.' : 'Aucun prêt saisi pour ce magasin.'}
        </Typography>
      )}
      {fiche && !fiche.id && <Box sx={{ px: 1.5, pb: 1.5 }}>{formulaire}</Box>}
      {peutSaisir && !fiche && (
        <Box sx={{ px: 2.5, pt: 1 }} className="pas-a-l-impression">
          <Button startIcon={<AddOutlined />} onClick={() => ouvrir(nouveauPret(annee))} sx={{ minHeight: 48 }}>Ajouter un prêt</Button>
        </Box>
      )}
    </Box>
  )
}

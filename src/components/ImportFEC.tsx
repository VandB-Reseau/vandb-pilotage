import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
import { chargerCorrespondancesFEC, enregistrerCorrespondancesFEC } from '../data/pilotage'
import { enChiffres, taux } from '../lib/format'
import { exceptionsDe, quadrimestresCouverts, RUBRIQUES_FEC, rubriqueFECLibelle, syntheseFEC, type CompteFEC, type EcritureFEC, type RubriqueFEC } from '../moteur/fec'
import { quadrimestreLibelle, type Quadrimestre, type SaisieQuadrimestre } from '../moteur/quadrimestre'

export interface FichierFEC { nom: string; ecritures: EcritureFEC[]; erreurs: string[] }
const MAX_DETAILS = 5
const ECART_CA = 0.02   // au-delà, le fichier ne couvre sans doute pas la même période que la caisse
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }
const jour = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR')

// FEC du comptable lu dans le navigateur : montants du quadrimestre, comptes à ranger, contrôle du CA face à la caisse
export function ImportFEC({ magasin, annee, fichier, caCaisse, libelles, peutGarder, reprendre, fermer }: {
  magasin: string
  annee: number
  fichier: FichierFEC
  caCaisse: Record<Quadrimestre, number>
  libelles: Record<keyof SaisieQuadrimestre, string>
  peutGarder: boolean
  reprendre: (q: Quadrimestre, montants: SaisieQuadrimestre, avertissement: string | null) => void
  fermer: () => void
}) {
  const couverts = quadrimestresCouverts(fichier.ecritures, annee)
  const [q, setQ] = useState<Quadrimestre | null>(couverts[couverts.length - 1] ?? null)
  const [gardees, setGardees] = useState<Record<string, RubriqueFEC> | null>(null)
  const [choix, setChoix] = useState<Record<string, RubriqueFEC>>({})
  const [detail, setDetail] = useState(false)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { void chargerCorrespondancesFEC(magasin).then(setGardees) }, [magasin])

  const dates = fichier.ecritures.map((e) => e.date).sort()
  const ecartes = fichier.erreurs.length > 0 && (
    <Alert severity="error">
      {fichier.erreurs.length === 1 ? 'Une ligne est écartée :' : `${fichier.erreurs.length} lignes sont écartées :`}
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
        {fichier.erreurs.slice(0, MAX_DETAILS).map((t) => <li key={t}>{t}</li>)}
        {fichier.erreurs.length > MAX_DETAILS && <li>et {fichier.erreurs.length - MAX_DETAILS} autres.</li>}
      </Box>
    </Alert>
  )
  const entete = <Typography sx={{ fontWeight: 600 }}>FEC du comptable : {fichier.nom}</Typography>
  const annuler = <Button onClick={fermer} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>

  if (!q || gardees === null) {
    return (
      <Stack spacing={1.5} component="section" aria-label="FEC du comptable" sx={{ px: 2.5, pb: 2 }}>
        {entete}
        {ecartes}
        {gardees !== null && (
          <Alert severity="warning">
            {dates.length
              ? `Ce fichier va du ${jour(dates[0])} au ${jour(dates[dates.length - 1])} : il ne couvre aucun quadrimestre ${annee} en entier. Demande au cabinet un FEC arrêté à fin avril, fin août ou fin décembre.`
              : 'Ce fichier ne contient aucune écriture lisible. Demande au cabinet l’export FEC du magasin.'}
          </Alert>
        )}
        <Box>{annuler}</Box>
      </Stack>
    )
  }

  const exceptions = { ...gardees, ...choix }
  const s = syntheseFEC(fichier.ecritures, annee, q, exceptions)
  const ca = caCaisse[q]
  const ecartCA = ca > 0 ? (s.caFEC - ca) / ca : null
  const ranger = (c: CompteFEC) => (
    <TextField select size="small" value={c.rubrique ?? ''} sx={{ width: 220, ...champ }}
      slotProps={{ select: { displayEmpty: true, SelectDisplayProps: { 'aria-label': `Rubrique du compte ${c.compte}` } as object } }}
      onChange={(e) => setChoix((x) => ({ ...x, [c.compte]: e.target.value as RubriqueFEC }))}>
      {RUBRIQUES_FEC.map((r) => <MenuItem key={r} value={r} sx={{ minHeight: 48 }}>{rubriqueFECLibelle[r]}</MenuItem>)}
    </TextField>
  )
  const tableComptes = (comptes: CompteFEC[], titre: string) => (
    <TableContainer>
      <Table size="small" aria-label={titre} sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Compte</TableCell>
            <TableCell>Libellé</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell>Rubrique</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {comptes.map((c) => (
            <TableRow key={c.compte}>
              <TableCell>{c.compte}</TableCell>
              <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.libelle}</TableCell>
              <TableCell align="right">{enChiffres(Math.round(c.montant))}</TableCell>
              <TableCell sx={{ py: 0.5 }}>{ranger(c)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const valider = async () => {
    setOccupe(true)
    let avertissement: string | null = null
    if (peutGarder) {
      try {
        await enregistrerCorrespondancesFEC(magasin, s.comptes.map((c) => c.compte), exceptionsDe(s.comptes))
      } catch {
        avertissement = 'Le classement des comptes n’a pas pu être gardé pour le prochain import.'
      }
    }
    setOccupe(false)
    reprendre(q, s.montants, avertissement)
  }

  return (
    <Stack spacing={1.5} component="section" aria-label="FEC du comptable" sx={{ px: 2.5, pb: 2 }}>
      {entete}
      {couverts.length > 1 && (
        <ToggleButtonGroup exclusive size="small" value={q} onChange={(_, v: Quadrimestre | null) => v && setQ(v)} aria-label="Quadrimestre repris du FEC">
          {couverts.map((x) => <ToggleButton key={x} value={x} sx={{ minHeight: 48, textTransform: 'none' }}>{quadrimestreLibelle[x]}</ToggleButton>)}
        </ToggleButtonGroup>
      )}
      {ecartes}
      {!s.stockPasse && <Alert severity="warning">Pas de stock de fin de période dans le fichier : la variation de stock reste à saisir.</Alert>}
      {ecartCA !== null && Math.abs(ecartCA) > ECART_CA && (
        <Alert severity="warning">
          CA du FEC : {enChiffres(Math.round(s.caFEC))} €, CA de la caisse : {enChiffres(Math.round(ca))} € ({ecartCA > 0 ? '+' : ''}{taux(ecartCA)}). Le fichier ne couvre peut-être pas toute la période.
        </Alert>
      )}
      {s.aClasser.length > 0 && (
        <>
          <Alert severity="info">{s.aClasser.length === 1 ? 'Un compte à ranger' : `${s.aClasser.length} comptes à ranger`} avant de reprendre les montants.</Alert>
          {tableComptes(s.aClasser, 'Comptes à ranger')}
        </>
      )}
      <TableContainer>
        <Table size="small" aria-label={`Montants du FEC : ${quadrimestreLibelle[q].toLowerCase()} ${annee}`} sx={{ maxWidth: 560, '& td': { whiteSpace: 'nowrap' } }}>
          <TableBody>
            {(Object.keys(libelles) as (keyof SaisieQuadrimestre)[]).map((k) => (
              <TableRow key={k}>
                <TableCell>{libelles[k]}</TableCell>
                <TableCell align="right" sx={s.montants[k] === null ? { color: 'text.disabled' } : undefined}>{s.montants[k] === null ? '–' : enChiffres(Math.round(s.montants[k]!))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box>
        <Button onClick={() => setDetail((d) => !d)} aria-expanded={detail} sx={{ minHeight: 48 }}>
          {detail ? 'Masquer les comptes' : `Voir les comptes (${s.comptes.length})`}
        </Button>
      </Box>
      {detail && tableComptes(s.comptes, 'Comptes de charges du FEC')}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="contained" disabled={occupe || s.aClasser.length > 0} onClick={() => void valider()} sx={{ minHeight: 48 }}>
          Reprendre : {quadrimestreLibelle[q].toLowerCase()}
        </Button>
        {annuler}
      </Box>
    </Stack>
  )
}

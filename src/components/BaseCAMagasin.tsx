import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { enregistrerOuverture } from '../data/pilotage'
import { ecartTaux, milliers, MOIS_LONGS } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import { trancheLibelle, trancheMillesime, type Ouverture } from '../moteur/projection'
import { universLibelle, type Budget, type RythmeSortie, type UniversTickets } from '../moteur/types'

const STATUT: Record<RythmeSortie['statut'], string> = { applique: 'Rythme de sortie retenu', a_confirmer: 'Écart de plus de 15 % : à confirmer', ignore: 'Atterrissage gardé' }
const enMois = (o: Ouverture | undefined) => (o ? `${o.annee}-${String(o.mois).padStart(2, '0')}` : '')

// Base du CA de l'an prochain : rythme de sortie de la Cave et du Bar face à l'atterrissage, ancienneté du magasin
export function BaseCAMagasin({ magasin, budget, annee, ouverture, rythme, onRythme, directeur, peutAjuster, apresOuverture }: {
  magasin: string
  budget: Budget
  annee: number
  ouverture: Ouverture | undefined
  rythme: Cibles['rythme']
  onRythme: (r: Cibles['rythme']) => void
  directeur: boolean
  peutAjuster: boolean
  apresOuverture: () => void
}) {
  const [date, setDate] = useState(enMois(ouverture))
  // Date relue après l'enregistrement
  const lueEnBase = enMois(ouverture)
  useEffect(() => { setDate(lueEnBase) }, [lueEnBase])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const lue = /^\d{4}-(0[1-9]|1[0-2])$/.test(date) ? { annee: Number(date.slice(0, 4)), mois: Number(date.slice(5, 7)) } : null
  const tranche = trancheMillesime(ouverture, annee)
  const univers = (['cave', 'bar'] as UniversTickets[]).filter((u) => budget.sortie?.[u])
  const choisir = (u: UniversTickets, v: 'applique' | 'ignore' | undefined) => {
    const r = { ...rythme }
    if (v) r[u] = v
    else delete r[u]
    onRythme(Object.keys(r).length ? r : undefined)
  }
  const enregistrer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerOuverture(magasin, lue)
      setMessage({ gravite: 'success', texte: 'Date d’ouverture enregistrée.' })
      apresOuverture()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Card component="section" aria-label="Base du CA">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Base du CA</Typography>
        <Typography variant="body2" color="text.secondary">
          {ouverture ? `Ouvert en ${MOIS_LONGS[ouverture.mois - 1]} ${ouverture.annee} · ${trancheLibelle[tranche!]} en ${annee}` : 'Date d’ouverture à renseigner'}
        </Typography>
      </Box>
      {message && <Box sx={{ px: 2.5 }}><Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>}
      {directeur && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', px: 2.5, py: 1 }} className="pas-a-l-impression">
          <TextField type="month" size="small" label="Ouvert depuis" value={date} onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Mois d’ouverture du magasin' } }} sx={{ width: 200, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
          <Button variant="outlined" startIcon={<SaveOutlined />} disabled={occupe || date === enMois(ouverture) || (date !== '' && !lue)} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>
            Enregistrer la date
          </Button>
        </Box>
      )}
      {univers.length ? (
        <TableContainer>
          <Table size="small" aria-label={`Base du CA ${annee}`} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Univers</TableCell>
                <TableCell align="right">Atterrissage {annee - 1} hors temps forts</TableCell>
                <TableCell align="right">Rythme de sortie</TableCell>
                <TableCell align="right">Écart</TableCell>
                <TableCell>Base retenue</TableCell>
                {directeur && peutAjuster && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {univers.map((u) => {
                const s = budget.sortie![u]!
                return (
                  <TableRow key={u}>
                    <TableCell sx={{ fontWeight: 600 }}>{universLibelle[u]}</TableCell>
                    <TableCell align="right">{milliers(s.atterri)}</TableCell>
                    <TableCell align="right">{milliers(s.annuel)} <Box component="span" sx={{ color: 'text.secondary' }}>({MOIS_LONGS[s.de - 1]} à {MOIS_LONGS[s.a - 1]})</Box></TableCell>
                    <TableCell align="right">{ecartTaux(s.acquis)}</TableCell>
                    <TableCell sx={{ color: s.statut === 'a_confirmer' ? 'warning.dark' : undefined, fontWeight: s.statut === 'a_confirmer' ? 700 : 400 }}>{STATUT[s.statut]}</TableCell>
                    {directeur && peutAjuster && (
                      <TableCell className="pas-a-l-impression">
                        {s.statut === 'a_confirmer' && <Button size="small" onClick={() => choisir(u, 'applique')} sx={{ minHeight: 48 }}>Retenir le rythme {universLibelle[u]}</Button>}
                        {s.statut === 'applique' && <Button size="small" color="inherit" onClick={() => choisir(u, 'ignore')} sx={{ minHeight: 48 }}>Garder l’atterrissage {universLibelle[u]}</Button>}
                        {s.statut === 'ignore' && <Button size="small" color="inherit" onClick={() => choisir(u, undefined)} sx={{ minHeight: 48 }}>Reprendre le calcul {universLibelle[u]}</Button>}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>
          Base : atterrissage {annee - 1}. Le rythme de sortie se mesure dès 4 mois de réel, à la prochaine mise à jour de la proposition.
        </Typography>
      )}
    </Card>
  )
}

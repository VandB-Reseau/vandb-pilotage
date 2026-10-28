import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { ecartMontant, MOIS_LONGS } from '../lib/format'
import { UNIVERS, universLibelle, type AjustementCA } from '../moteur/types'
import { ChampMontant } from './ChampMontant'
import { ChampTaux } from './ChampTaux'
import { ChoixListe } from './ChoixListe'
import { Aide } from './Aide'

const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const sx = { '& td, & th': { px: 0.75, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }

// Ajustements datés du CA : client gagné ou perdu, concurrent, horaires. En euros HT par mois, ou en part du CA de l'univers.
export function AjustementsCAMagasin({ ajustements, onChange, lectureSeule, annee, effet }: {
  ajustements: AjustementCA[] | undefined
  onChange: (l: AjustementCA[] | undefined) => void
  lectureSeule: boolean
  annee: number
  effet: number   // effet sur le CA de l'année
}) {
  const liste = ajustements ?? []
  const ajouter = () => onChange([...liste, { libelle: '', univers: 'exterieur', de: 1, a: 12, montant: 0 }])
  if (!liste.length) {
    if (lectureSeule) return null
    return (
      <Box className="pas-a-l-impression">
        <Button variant="outlined" startIcon={<TuneOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter un client gagné ou perdu</Button>
      </Box>
    )
  }
  const changer = (i: number, a: AjustementCA) => onChange(liste.map((x, j) => (j === i ? a : x)))
  return (
    <Card component="section" aria-label="Clients gagnés ou perdus">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Clients gagnés ou perdus</Typography><Aide sujet="ajustements" /></Box>
        <Typography variant="body2" color="text.secondary">CA {annee} : {ecartMontant(effet)}</Typography>
      </Box>
      <TableContainer>
        <Table size="small" aria-label={`Clients gagnés ou perdus ${annee}`} sx={sx}>
          <TableHead>
            <TableRow>
              <TableCell>Client ou événement</TableCell>
              <TableCell>Univers</TableCell>
              <TableCell>De</TableCell>
              <TableCell>À</TableCell>
              <TableCell>En</TableCell>
              <TableCell align="right">Chaque mois</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {liste.map((a, i) => {
              const nom = a.libelle.trim() || `ajustement ${i + 1}`
              const enTaux = a.montant === undefined
              return (
                <TableRow key={i}>
                  <TableCell>
                    <TextField size="small" value={a.libelle} disabled={lectureSeule} placeholder="Association sportive" onChange={(e) => changer(i, { ...a, libelle: e.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Client ou événement ${i + 1}`, maxLength: 60 } }} sx={{ width: 200, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
                  </TableCell>
                  <TableCell>
                    <ChoixListe libelle={`Univers : ${nom}`} valeur={a.univers} desactive={lectureSeule} largeur={120}
                      options={UNIVERS.map((u) => ({ valeur: u, libelle: universLibelle[u] }))} onChange={(v) => changer(i, { ...a, univers: v })} />
                  </TableCell>
                  <TableCell><ChoixListe libelle={`De : ${nom}`} valeur={a.de} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { ...a, de: v, a: Math.max(v, a.a) })} /></TableCell>
                  <TableCell><ChoixListe libelle={`À : ${nom}`} valeur={a.a} options={MOIS_OPTIONS.filter((m) => m.valeur >= a.de)} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { ...a, a: v })} /></TableCell>
                  <TableCell>
                    <ChoixListe libelle={`Unité : ${nom}`} valeur={enTaux ? 'taux' : 'montant'} desactive={lectureSeule} largeur={170}
                      options={[{ valeur: 'montant', libelle: 'Euros HT' }, { valeur: 'taux', libelle: '% du CA de l’univers' }]}
                      onChange={(v) => { const { montant: _, taux: __, ...reste } = a; changer(i, v === 'taux' ? { ...reste, taux: 0 } : { ...reste, montant: 0 }) }} />
                  </TableCell>
                  <TableCell align="right">
                    {enTaux
                      ? <ChampTaux libelle={`Part du CA : ${nom}`} valeur={a.taux || undefined} heritee={0} desactive={lectureSeule} onChange={(v) => changer(i, { ...a, taux: v ?? 0 })} />
                      : <ChampMontant libelle={`Montant par mois : ${nom}`} valeur={a.montant ?? 0} desactive={lectureSeule} onChange={(v) => changer(i, { ...a, montant: v })} />}
                  </TableCell>
                  <TableCell>
                    {!lectureSeule && (
                      <Tooltip title="Retirer">
                        <IconButton aria-label={`Retirer ${nom}`} onClick={() => onChange(liste.length > 1 ? liste.filter((_, j) => j !== i) : undefined)} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {!lectureSeule && (
        <Box sx={{ px: 2.5, py: 1.5 }} className="pas-a-l-impression">
          <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter une ligne</Button>
        </Box>
      )}
    </Card>
  )
}

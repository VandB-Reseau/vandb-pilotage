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
import CelebrationOutlined from '@mui/icons-material/CelebrationOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { milliers, MOIS_LONGS } from '../lib/format'
import { UNIVERS, universLibelle, type Budget, type TempsFort, type TypeTempsFort, type Univers } from '../moteur/types'
import { ChampMontant } from './ChampMontant'
import { ChoixListe } from './ChoixListe'

export const typeLibelle: Record<TypeTempsFort, string> = { exterieur: 'Événement extérieur', soiree: 'Soirée en magasin', operation: 'Opération commerciale' }
const universDuType: Record<TypeTempsFort, Univers> = { exterieur: 'exterieur', soiree: 'bar', operation: 'cave' }
const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const sx = { '& td, & th': { px: 0.75, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }

// Temps forts du magasin : événements extérieurs, soirées, opérations commerciales. CA de l'an passé et du budget,
// charges propres, mois où les achats sont payés.
export function TempsFortsMagasin({ tempsForts, onChange, lectureSeule, annee, budget }: {
  tempsForts: TempsFort[] | undefined
  onChange: (l: TempsFort[] | undefined) => void
  lectureSeule: boolean
  annee: number
  budget: Budget
}) {
  const liste = tempsForts ?? []
  const ajouter = () => onChange([...liste, { nom: '', type: 'exterieur', mois: 6, univers: 'exterieur', caAnPasse: 0, ca: 0, extrasPersonnel: 0, autresCharges: 0, moisAchats: 5 }])
  if (!liste.length) {
    if (lectureSeule) return null
    return (
      <Box className="pas-a-l-impression">
        <Button variant="outlined" startIcon={<CelebrationOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Prévoir un temps fort</Button>
      </Box>
    )
  }
  const changer = (i: number, t: Partial<TempsFort>) => onChange(liste.map((x, j) => (j === i ? { ...x, ...t } : x)))
  const tf = budget.tempsForts
  return (
    <Card component="section" aria-label="Temps forts">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Temps forts</Typography>
        {tf && (
          <Typography variant="body2" color="text.secondary">
            CA {annee - 1} retiré : {milliers(tf.retire)} · CA {annee} ajouté : {milliers(tf.ajoute)} · Charges : {milliers(tf.charges)}
          </Typography>
        )}
      </Box>
      <TableContainer>
        <Table size="small" aria-label={`Temps forts ${annee}`} sx={sx}>
          <TableHead>
            <TableRow>
              <TableCell>Temps fort</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Mois</TableCell>
              <TableCell>Univers</TableCell>
              <TableCell align="right">CA {annee - 1} HT</TableCell>
              <TableCell align="right">CA {annee} HT</TableCell>
              <TableCell align="right">Extras de personnel</TableCell>
              <TableCell align="right">Autres charges</TableCell>
              <TableCell>Achats payés en</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {liste.map((t, i) => {
              const nom = t.nom.trim() || `temps fort ${i + 1}`
              return (
                <TableRow key={i}>
                  <TableCell>
                    <TextField size="small" value={t.nom} disabled={lectureSeule} placeholder="Oktoberfest" onChange={(e) => changer(i, { nom: e.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Nom du temps fort ${i + 1}`, maxLength: 60 } }} sx={{ width: 180, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
                  </TableCell>
                  <TableCell>
                    <ChoixListe libelle={`Type : ${nom}`} valeur={t.type} desactive={lectureSeule} largeur={200}
                      options={(Object.keys(typeLibelle) as TypeTempsFort[]).map((k) => ({ valeur: k, libelle: typeLibelle[k] }))}
                      onChange={(v) => changer(i, { type: v, univers: universDuType[v] })} />
                  </TableCell>
                  <TableCell><ChoixListe libelle={`Mois : ${nom}`} valeur={t.mois} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { mois: v })} /></TableCell>
                  <TableCell>
                    <ChoixListe libelle={`Univers : ${nom}`} valeur={t.univers} desactive={lectureSeule} largeur={120}
                      options={UNIVERS.map((u) => ({ valeur: u, libelle: universLibelle[u] }))} onChange={(v) => changer(i, { univers: v })} />
                  </TableCell>
                  <TableCell align="right"><ChampMontant libelle={`CA ${annee - 1} : ${nom}`} valeur={t.caAnPasse} desactive={lectureSeule} onChange={(v) => changer(i, { caAnPasse: v })} /></TableCell>
                  <TableCell align="right"><ChampMontant libelle={`CA ${annee} : ${nom}`} valeur={t.ca} desactive={lectureSeule} onChange={(v) => changer(i, { ca: v })} /></TableCell>
                  <TableCell align="right"><ChampMontant libelle={`Extras de personnel : ${nom}`} valeur={t.extrasPersonnel} desactive={lectureSeule} largeur={120} onChange={(v) => changer(i, { extrasPersonnel: v })} /></TableCell>
                  <TableCell align="right"><ChampMontant libelle={`Autres charges : ${nom}`} valeur={t.autresCharges} desactive={lectureSeule} largeur={120} onChange={(v) => changer(i, { autresCharges: v })} /></TableCell>
                  <TableCell><ChoixListe libelle={`Achats payés en : ${nom}`} valeur={t.moisAchats} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { moisAchats: v })} /></TableCell>
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
          <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter un temps fort</Button>
        </Box>
      )}
    </Card>
  )
}

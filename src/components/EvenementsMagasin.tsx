import { Fragment, useState } from 'react'
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
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { ecartMontant, montant, MOIS_LONGS, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import { faceAnPasse } from '../moteur/budget'
import { UNIVERS, universLibelle, type AjustementCA, type TempsFort, type TypeTempsFort, type Univers } from '../moteur/types'
import { ChampMontant } from './ChampMontant'
import { ChoixListe } from './ChoixListe'
import { Aide } from './Aide'
import { styleTableau } from '../theme/tableau'

export const typeLibelle: Record<TypeTempsFort, string> = { exterieur: 'Événement extérieur', soiree: 'Soirée en magasin', operation: 'Opération commerciale' }
const universDuType: Record<TypeTempsFort, Univers> = { exterieur: 'exterieur', soiree: 'bar', operation: 'cave' }
const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const UNIVERS_OPTIONS = UNIVERS.map((u) => ({ valeur: u, libelle: universLibelle[u] }))
const sx = { ...styleTableau, '& td, & th': { px: 0.75, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }
const champTexte = { width: 190, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

// Client d'avant le 03/11/2026, saisi en montant par mois : lu comme CA de l'an passé et de l'année (même écart)
export function clientFaceAnPasse(a: AjustementCA): { caAnPasse: number; ca: number } | null {
  if (faceAnPasse(a)) return { caAnPasse: a.caAnPasse ?? 0, ca: a.ca ?? 0 }
  if (!Number.isFinite(a.montant)) return null
  const total = a.montant! * (a.a - a.de + 1)
  return total >= 0 ? { caAnPasse: 0, ca: total } : { caAnPasse: -total, ca: 0 }
}

// Joseph (03/11/2026) : temps forts et clients extérieurs dans un seul tableau, face à l'an passé ; les charges propres
// d'un temps fort et le mois où ses achats sont payés se déplient sous sa ligne
export function EvenementsMagasin({ cibles, onChange, lectureSeule, annee }: {
  cibles: Cibles; onChange: (c: Cibles) => void; lectureSeule: boolean; annee: number
}) {
  const tf = cibles.tempsForts ?? []
  const clients = cibles.ajustementsCA ?? []
  const [ouvert, setOuvert] = useState<number | null>(null)
  const ecrire = <K extends 'tempsForts' | 'ajustementsCA'>(k: K, l: NonNullable<Cibles[K]>) => {
    const { [k]: _, ...reste } = cibles
    onChange(l.length ? { ...reste, [k]: l } : reste)
  }
  const changerTF = (i: number, x: Partial<TempsFort>) => ecrire('tempsForts', tf.map((y, j) => (j === i ? { ...y, ...x } : y)))
  const changerClient = (i: number, x: Partial<AjustementCA>) => ecrire('ajustementsCA', clients.map((y, j) => {
    if (j !== i) return y
    const face = clientFaceAnPasse(y) ?? { caAnPasse: 0, ca: 0 }
    const { montant: _m, taux: _t, ...reste } = y
    // Un CA saisi fait passer un ancien client « par mois » à la saisie face à l'an passé
    return 'ca' in x || 'caAnPasse' in x ? { ...reste, ...face, ...x } : { ...y, ...x }
  }))
  const ecartClient = (a: AjustementCA) => { const f = clientFaceAnPasse(a); return f ? f.ca - f.caAnPasse : null }
  const totalAnPasse = somme(tf.map((t) => t.caAnPasse || 0)) + somme(clients.map((a) => clientFaceAnPasse(a)?.caAnPasse ?? 0))
  const totalAnnee = somme(tf.map((t) => t.ca || 0)) + somme(clients.map((a) => clientFaceAnPasse(a)?.ca ?? 0))
  const vide = !tf.length && !clients.length
  return (
    <Card component="section" aria-label={`Évènements face à ${annee - 1}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2">{`Ce qui change face à ${annee - 1}`}</Typography><Aide sujet="tempsForts" />
      </Box>
      {vide ? (
        <Typography color="text.secondary" sx={{ px: 2.5, pb: 1 }}>Aucun temps fort ni client extérieur prévu.</Typography>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={`Temps forts et clients extérieurs ${annee}`} sx={sx}>
            <TableHead>
              <TableRow>
                <TableCell>Évènement ou client</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Mois</TableCell>
                <TableCell>Univers</TableCell>
                <TableCell align="right">{`CA ${annee - 1} HT`}</TableCell>
                <TableCell align="right">{`CA ${annee} HT`}</TableCell>
                <TableCell align="right">Écart</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {tf.map((t, i) => {
                const nom = t.nom.trim() || `temps fort ${i + 1}`
                const detail = ouvert === i
                return (
                  <Fragment key={`tf-${i}`}>
                    <TableRow>
                      <TableCell>
                        <TextField size="small" value={t.nom} disabled={lectureSeule} placeholder="Marché de Noël" onChange={(e) => changerTF(i, { nom: e.target.value })}
                          slotProps={{ htmlInput: { 'aria-label': `Nom du temps fort ${i + 1}`, maxLength: 60 } }} sx={champTexte} />
                      </TableCell>
                      <TableCell>
                        <ChoixListe libelle={`Type : ${nom}`} valeur={t.type} desactive={lectureSeule} largeur={200}
                          options={(Object.keys(typeLibelle) as TypeTempsFort[]).map((k) => ({ valeur: k, libelle: typeLibelle[k] }))}
                          onChange={(v) => changerTF(i, { type: v, univers: universDuType[v] })} />
                      </TableCell>
                      <TableCell><ChoixListe libelle={`Mois : ${nom}`} valeur={t.mois} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changerTF(i, { mois: v })} /></TableCell>
                      <TableCell><ChoixListe libelle={`Univers : ${nom}`} valeur={t.univers} desactive={lectureSeule} largeur={120} options={UNIVERS_OPTIONS} onChange={(v) => changerTF(i, { univers: v })} /></TableCell>
                      <TableCell align="right"><ChampMontant libelle={`CA ${annee - 1} : ${nom}`} valeur={t.caAnPasse} desactive={lectureSeule} onChange={(v) => changerTF(i, { caAnPasse: v })} /></TableCell>
                      <TableCell align="right"><ChampMontant libelle={`CA ${annee} : ${nom}`} valeur={t.ca} desactive={lectureSeule} onChange={(v) => changerTF(i, { ca: v })} /></TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: (t.ca || 0) - (t.caAnPasse || 0) < 0 ? 'error.main' : 'success.dark' }}>{ecartMontant((t.ca || 0) - (t.caAnPasse || 0))}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex' }}>
                          <Tooltip title={detail ? 'Replier' : 'Charges et paiement des achats'}>
                            <IconButton aria-label={`${detail ? 'Replier' : 'Déplier'} le détail : ${nom}`} aria-expanded={detail} onClick={() => setOuvert(detail ? null : i)} sx={{ width: 48, height: 48 }}>
                              {detail ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
                            </IconButton>
                          </Tooltip>
                          {!lectureSeule && (
                            <Tooltip title="Retirer">
                              <IconButton aria-label={`Retirer ${nom}`} onClick={() => ecrire('tempsForts', tf.filter((_, j) => j !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                    {detail && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ bgcolor: 'action.hover' }}>
                          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', py: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">Autres charges</Typography>
                              <ChampMontant libelle={`Autres charges : ${nom}`} valeur={t.autresCharges} desactive={lectureSeule} largeur={120} onChange={(v) => changerTF(i, { autresCharges: v })} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">Achats payés en</Typography>
                              <ChoixListe libelle={`Achats payés en : ${nom}`} valeur={t.moisAchats} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changerTF(i, { moisAchats: v })} />
                            </Box>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
              {clients.map((a, i) => {
                const nom = a.libelle.trim() || `client ${i + 1}`
                const face = clientFaceAnPasse(a)
                const ecart = ecartClient(a)
                return (
                  <TableRow key={`client-${i}`}>
                    <TableCell>
                      <TextField size="small" value={a.libelle} disabled={lectureSeule} placeholder="Comité d’entreprise" onChange={(e) => changerClient(i, { libelle: e.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': `Nom du client ${i + 1}`, maxLength: 60 } }} sx={champTexte} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{ecart === null ? 'Client extérieur' : ecart < 0 ? 'Client perdu' : 'Client gagné'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ChoixListe libelle={`Premier mois : ${nom}`} valeur={a.de} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={120} onChange={(v) => changerClient(i, { de: v, a: Math.max(v, a.a) })} />
                        <Typography variant="body2">à</Typography>
                        <ChoixListe libelle={`Dernier mois : ${nom}`} valeur={a.a} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={120} onChange={(v) => changerClient(i, { a: v, de: Math.min(v, a.de) })} />
                      </Box>
                    </TableCell>
                    <TableCell><ChoixListe libelle={`Univers : ${nom}`} valeur={a.univers} desactive={lectureSeule} largeur={120} options={UNIVERS_OPTIONS} onChange={(v) => changerClient(i, { univers: v })} /></TableCell>
                    <TableCell align="right"><ChampMontant libelle={`CA ${annee - 1} : ${nom}`} valeur={face?.caAnPasse ?? 0} desactive={lectureSeule} onChange={(v) => changerClient(i, { caAnPasse: Math.max(0, v) })} /></TableCell>
                    <TableCell align="right"><ChampMontant libelle={`CA ${annee} : ${nom}`} valeur={face?.ca ?? 0} desactive={lectureSeule} onChange={(v) => changerClient(i, { ca: Math.max(0, v) })} /></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: ecart !== null && ecart < 0 ? 'error.main' : 'success.dark' }}>
                      {ecart === null ? `${taux(a.taux ?? 0)} du CA` : ecartMontant(ecart)}
                    </TableCell>
                    <TableCell>
                      {!lectureSeule && (
                        <Tooltip title="Retirer">
                          <IconButton aria-label={`Retirer ${nom}`} onClick={() => ecrire('ajustementsCA', clients.filter((_, j) => j !== i))} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="ligne-cle">
                <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell colSpan={3} />
                <TableCell align="right" sx={{ fontWeight: 700 }}>{montant(totalAnPasse)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{montant(totalAnnee)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{ecartMontant(totalAnnee - totalAnPasse)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!lectureSeule && (
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }} className="pas-a-l-impression">
          <Button startIcon={<AddOutlined />} onClick={() => ecrire('tempsForts', [...tf, { nom: '', type: 'exterieur', mois: 6, univers: 'exterieur', caAnPasse: 0, ca: 0, autresCharges: 0, moisAchats: 5 }])} sx={{ minHeight: 48 }}>Ajouter un temps fort</Button>
          <Button startIcon={<AddOutlined />} onClick={() => ecrire('ajustementsCA', [...clients, { libelle: '', univers: 'exterieur', de: 1, a: 12, caAnPasse: 0, ca: 0 }])} sx={{ minHeight: 48 }}>Ajouter un client extérieur</Button>
        </Box>
      )}
    </Card>
  )
}

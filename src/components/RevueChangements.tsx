import { useState, type ReactNode } from 'react'
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
import SendOutlined from '@mui/icons-material/SendOutlined'
import { ecartMilliers, milliers, montant, taux } from '../lib/format'
import type { Changement, Nature, PointValidation } from '../moteur/changements'
import { styleTableau } from '../theme/tableau'

// Lot 41, proposition 3 : ce que le magasin a changé par rapport au siège, avec l'effet de chaque changement sur l'EBE.
// Le franchisé l'envoie au siège (avec un mot s'il veut) ; le RR et le Directeur le relisent, répondent ou valident.
const MAX_MOT = 2000
function valeur(v: unknown, nature: Nature, cote: 'avant' | 'apres', autre: unknown): string {
  if (v === undefined || v === null) return cote === 'avant' ? 'Par défaut' : 'Retiré'
  if (nature === 'taux' && typeof v === 'number') return taux(v)
  if (nature === 'montant' && typeof v === 'number') return montant(v)
  return autre === undefined || autre === null ? 'Ajouté' : 'Modifié'
}

export function RevueChangements({ franchise, effets, total, ebeSiege, ebeMagasin, envoyeLe, statut, occupe, onEnvoyer, validation }: {
  franchise: boolean
  effets: (Changement & { effet: number })[]
  total: number
  ebeSiege: number
  ebeMagasin: number
  envoyeLe: string | null | undefined
  statut: 'propose' | 'en_discussion' | 'valide' | null
  occupe: boolean
  onEnvoyer?: (mot: string) => void
  validation?: { points: PointValidation[]; bouton: ReactNode }
}) {
  const [mot, setMot] = useState('')
  const titre = franchise ? 'Mes changements par rapport au siège' : 'Ce que le magasin a changé'
  const envoye = envoyeLe ? `Envoyé au siège le ${new Date(envoyeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : null
  return (
    <Card component="section" aria-label={titre} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 220 }}>{titre}</Typography>
        {envoye && <Typography variant="body2" color="text.secondary">{envoye}</Typography>}
      </Box>
      {effets.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {franchise ? 'Aucun changement : le budget est celui proposé par le siège.' : 'Aucun changement : le budget est celui proposé par le siège.'}
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={titre} sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell>Hypothèse</TableCell>
                <TableCell align="right">Siège</TableCell>
                <TableCell align="right">Magasin</TableCell>
                <TableCell align="right">Effet sur l’EBE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {effets.map((e) => (
                <TableRow key={e.cle}>
                  <TableCell sx={{ whiteSpace: 'normal' }}>{e.libelle}</TableCell>
                  <TableCell align="right">{valeur(e.avant, e.nature, 'avant', e.apres)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{valeur(e.apres, e.nature, 'apres', e.avant)}</TableCell>
                  <TableCell align="right" sx={{ color: Math.abs(e.effet) < 50 ? 'text.secondary' : e.effet < 0 ? 'error.main' : 'success.dark', fontWeight: 600 }}>
                    {Math.abs(e.effet) < 50 ? 'Aucun' : ecartMilliers(e.effet)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="ligne-cle">
                <TableCell sx={{ fontWeight: 700 }}>EBE</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{milliers(ebeSiege)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{milliers(ebeMagasin)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: total < 0 ? 'error.main' : 'success.dark' }}>{ecartMilliers(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {franchise && onEnvoyer && statut !== 'valide' && (
        <Box sx={{ mt: 2, display: 'grid', gap: 1.5 }}>
          <TextField label="Un mot pour le siège (facultatif)" multiline minRows={2} value={mot} onChange={(e) => setMot(e.target.value.slice(0, MAX_MOT))} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe} onClick={() => { onEnvoyer(mot.trim()); setMot('') }} sx={{ minHeight: 48 }}>
              {statut === 'en_discussion' ? 'Envoyer de nouveau au siège' : 'Envoyer au siège'}
            </Button>
            <Typography variant="body2" color="text.secondary">
              {effets.length ? 'Le budget passe en discussion : le siège voit ce tableau.' : 'Sans changement, l’envoi dit au siège que le budget te convient.'}
            </Typography>
          </Box>
        </Box>
      )}
      {validation && (
        <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
          {validation.points.map((p) => <Alert key={p.cle} severity="warning">{p.texte}</Alert>)}
          <Box>{validation.bouton}</Box>
        </Box>
      )}
    </Card>
  )
}

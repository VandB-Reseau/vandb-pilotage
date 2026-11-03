import { Fragment, useState, type ReactNode } from 'react'
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
import Typography from '@mui/material/Typography'
import SendOutlined from '@mui/icons-material/SendOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { ecartMilliers, milliers, montant, taux } from '../lib/format'
import type { Nature, PointValidation, ThemeChange } from '../moteur/changements'
import { styleTableau } from '../theme/tableau'

// Lot 41, proposition 3 : ce que le magasin a changé par rapport au siège, avec l'effet de chaque changement sur l'EBE.
// Le franchisé l'envoie au siège (avec un mot s'il veut) ; le RR et le Directeur le relisent, répondent ou valident.
function valeur(v: unknown, nature: Nature, cote: 'avant' | 'apres', autre: unknown): string {
  if (v === undefined || v === null) return cote === 'avant' ? 'Par défaut' : 'Retiré'
  if (nature === 'taux' && typeof v === 'number') return taux(v)
  if (nature === 'montant' && typeof v === 'number') return montant(v)
  return autre === undefined || autre === null ? 'Ajouté' : 'Modifié'
}

// Joseph (03/11/2026) : une ligne par thème, le détail se déplie ; le mot pour le siège passe par les commentaires
export function RevueChangements({ franchise, themes, total, ebeSiege, ebeMagasin, envoyeLe, statut, occupe, onEnvoyer, validation }: {
  franchise: boolean
  themes: ThemeChange[]
  total: number
  ebeSiege: number
  ebeMagasin: number
  envoyeLe: string | null | undefined
  statut: 'propose' | 'en_discussion' | 'valide' | null
  occupe: boolean
  onEnvoyer?: () => void
  validation?: { points: PointValidation[]; bouton: ReactNode }
}) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())
  const titre = franchise ? 'Mes changements par rapport au siège' : 'Ce que le magasin a changé'
  const envoye = envoyeLe ? `Envoyé au siège le ${new Date(envoyeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : null
  const nombre = themes.reduce((a, t) => a + t.effets.length, 0)
  const couleur = (v: number) => (Math.abs(v) < 50 ? 'text.secondary' : v < 0 ? 'error.main' : 'success.dark')
  const effet = (v: number) => (Math.abs(v) < 50 ? 'Aucun' : ecartMilliers(v))
  const basculer = (cle: string) => setOuverts((o) => { const n = new Set(o); if (n.has(cle)) n.delete(cle); else n.add(cle); return n })
  return (
    <Card component="section" aria-label={titre} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 220 }}>{titre}</Typography>
        {envoye && <Typography variant="body2" color="text.secondary">{envoye}</Typography>}
      </Box>
      {nombre === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 1 }}>Aucun changement : le budget est celui proposé par le siège.</Typography>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={titre} sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell>Thème</TableCell>
                <TableCell align="right">Changements</TableCell>
                <TableCell align="right">Effet sur l’EBE</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {themes.map((t) => {
                const cle = t.theme ?? 'autres'
                const ouvert = ouverts.has(cle)
                return (
                  <Fragment key={cle}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t.libelle}</TableCell>
                      <TableCell align="right">{t.effets.length}</TableCell>
                      <TableCell align="right" sx={{ color: couleur(t.effet), fontWeight: 600 }}>{effet(t.effet)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => basculer(cle)} aria-expanded={ouvert} aria-label={`${ouvert ? 'Replier' : 'Voir'} le détail : ${t.libelle}`}
                          endIcon={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ minHeight: 48 }}>Détail</Button>
                      </TableCell>
                    </TableRow>
                    {ouvert && t.effets.map((e) => (
                      <TableRow key={e.cle}>
                        <TableCell colSpan={2} sx={{ whiteSpace: 'normal', pl: 4, color: 'text.secondary' }}>
                          {`${e.libelle} : ${valeur(e.apres, e.nature, 'apres', e.avant)} au lieu de ${valeur(e.avant, e.nature, 'avant', e.apres).toLowerCase()}`}
                        </TableCell>
                        <TableCell align="right" sx={{ color: couleur(e.effet) }}>{effet(e.effet)}</TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </Fragment>
                )
              })}
              <TableRow className="ligne-cle">
                <TableCell sx={{ fontWeight: 700 }}>{`EBE : siège ${milliers(ebeSiege)}, magasin ${milliers(ebeMagasin)}`}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{nombre}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: total < 0 ? 'error.main' : 'success.dark' }}>{ecartMilliers(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {franchise && onEnvoyer && statut !== 'valide' && (
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe} onClick={() => onEnvoyer()} sx={{ minHeight: 48 }}>
            {statut === 'en_discussion' ? 'Envoyer de nouveau au siège' : 'Envoyer au siège'}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {nombre ? 'Le budget passe en discussion : le siège voit ce tableau. Un mot à ajouter ? Laisse un commentaire sur le point concerné.' : 'Sans changement, l’envoi dit au siège que le budget te convient.'}
          </Typography>
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

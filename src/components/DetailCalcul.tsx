import { Fragment, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import CalculateOutlined from '@mui/icons-material/CalculateOutlined'
import { ecartMontant, ecartTaux, montant, taux } from '../lib/format'
import { expliquerAtterrissage, expliquerCA, expliquerEBE, expliquerMarge, type Etape, type Explication } from '../moteur/explication'
import type { BaseDepuisReel } from '../moteur/atterrissage'
import type { Budget } from '../moteur/types'

type Quoi = 'ca' | 'marge' | 'ebe' | 'atterrissage'
const titres: Record<Quoi, string> = { ca: 'Chiffre d’affaires HT', marge: 'Marge commerciale', ebe: 'EBE', atterrissage: 'Chiffre d’affaires HT atterri' }

// « D'où vient ce chiffre ? » : le calcul du budget étape par étape, avec les chiffres du magasin (moteur src/moteur/explication)
export function DetailCalcul({ quoi, budget, annee, atterrissage }: { quoi: Quoi; budget: Budget; annee: number; atterrissage?: BaseDepuisReel }) {
  const [ouvert, setOuvert] = useState(false)
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const titre = `${titres[quoi]} ${annee}`
  const e: Explication = quoi === 'atterrissage' && atterrissage ? expliquerAtterrissage(atterrissage)
    : quoi === 'ca' ? expliquerCA(budget, annee) : quoi === 'marge' ? expliquerMarge(budget) : expliquerEBE(budget)
  const effet = (x: Etape) => {
    if (x.part !== undefined && x.montant !== undefined) return `${ecartMontant(x.montant)} (${taux(x.part)} du CA)`
    if (x.part !== undefined) return `× ${taux(x.part)}`
    if (x.diviseur !== undefined) return `÷ ${taux(x.diviseur)}`
    if (x.taux !== undefined) return ecartTaux(x.taux)
    if (x.montant !== undefined) return ecartMontant(x.montant)
    return ''
  }
  const plusieurs = e.groupes.length > 1
  return (
    <>
      <Button size="small" startIcon={<CalculateOutlined />} onClick={() => setOuvert(true)} className="pas-a-l-impression"
        aria-label={`D’où vient ce chiffre ? ${titres[quoi]}`} aria-haspopup="dialog" sx={{ alignSelf: 'flex-start', minHeight: { xs: 48, md: 32 }, px: 1, ml: -1 }}>
        D’où vient ce chiffre ?
      </Button>
      <Dialog open={ouvert} onClose={() => setOuvert(false)} fullScreen={telephone} maxWidth="sm" fullWidth aria-labelledby={`calcul-${quoi}`}>
        <DialogTitle id={`calcul-${quoi}`}>{titre}</DialogTitle>
        <DialogContent>
          <Table size="small" aria-label={`Calcul : ${titre}`} sx={{ '& td': { px: 1 }, '& td:first-of-type': { pl: 0 }, '& td:last-of-type': { pr: 0 } }}>
            <TableBody>
              {e.groupes.map((g) => (
                <Fragment key={g.titre}>
                  {plusieurs && (
                    <TableRow><TableCell colSpan={3} sx={{ fontWeight: 700, pt: 2, borderBottom: 0 }}>{g.titre}</TableCell></TableRow>
                  )}
                  {g.etapes.map((x, i) => (
                    <TableRow key={x.libelle}>
                      <TableCell>{x.libelle}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{i === 0 ? '' : effet(x)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: i === g.etapes.length - 1 ? 700 : 400 }}>{montant(x.resultat)}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              <TableRow sx={{ '& td': { fontWeight: 700, borderTop: 2, borderBottom: 0, borderColor: 'divider' } }}>
                <TableCell colSpan={2}>{titre}{quoi !== 'ca' && quoi !== 'atterrissage' && budget.ca ? ` (${taux(e.total / budget.ca)} du CA)` : ''}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{montant(e.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOuvert(false)} variant="contained" sx={{ minHeight: 48 }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

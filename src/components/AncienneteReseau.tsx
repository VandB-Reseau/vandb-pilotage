import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { taux } from '../lib/format'
import type { Cibles, ValeursMillesime } from '../moteur/cibles'
import { TRANCHES, trancheLibelle, type Calage, type Constat, type Tranche } from '../moteur/projection'
import { universLibelle, type UniversTickets } from '../moteur/types'
import { ChampTaux } from './ChampTaux'

type Cle = 'evolutionFlux' | 'evolutionPanier'
const COLONNES: { cle: Cle; u: UniversTickets; libelle: string }[] = [
  { cle: 'evolutionFlux', u: 'cave', libelle: 'Tickets Cave' }, { cle: 'evolutionFlux', u: 'bar', libelle: 'Tickets Bar' },
  { cle: 'evolutionPanier', u: 'cave', libelle: 'Panier Cave' }, { cle: 'evolutionPanier', u: 'bar', libelle: 'Panier Bar' },
]

// Valeurs du réseau selon l'ancienneté du magasin (tickets, panier en plus de la hausse tarifaire), face au constaté
export function AncienneteReseau({ cibles, onChange, calage, magasinsParTranche }: {
  cibles: Cibles
  onChange: (c: Cibles) => void
  calage: Calage | null
  magasinsParTranche: Record<Tranche, number>
}) {
  const valeur = (t: Tranche, c: Cle, u: UniversTickets) => cibles.millesimes?.[t]?.[c]?.[u]
  const ecrire = (t: Tranche, c: Cle, u: UniversTickets, v: number | undefined) => {
    const m = structuredClone(cibles.millesimes ?? {})
    const ligne: ValeursMillesime = m[t] ?? {}
    const champ = { ...ligne[c] }
    if (v === undefined) delete champ[u]
    else champ[u] = v
    if (Object.keys(champ).length) ligne[c] = champ
    else delete ligne[c]
    if (Object.keys(ligne).length) m[t] = ligne
    else delete m[t]
    const { millesimes: _, ...reste } = cibles
    onChange(Object.keys(m).length ? { ...reste, millesimes: m } : reste)
  }
  const constat = (t: Tranche, c: Cle, u: UniversTickets): Constat | null => (calage ? calage[t][u][c === 'evolutionFlux' ? 'tickets' : 'panier'] : null)
  // Reprendre les médianes publiées dans les cases vides
  const aReprendre = TRANCHES.flatMap((t) => COLONNES.filter((k) => valeur(t, k.cle, k.u) === undefined && constat(t, k.cle, k.u)?.mediane != null).map((k) => ({ t, k })))
  const reprendre = () => {
    let c = cibles
    for (const { t, k } of aReprendre) {
      const m = structuredClone(c.millesimes ?? {})
      m[t] = { ...m[t], [k.cle]: { ...m[t]?.[k.cle], [k.u]: constat(t, k.cle, k.u)!.mediane! } }
      c = { ...c, millesimes: m }
    }
    onChange(c)
  }
  return (
    <Box component="section" aria-label="Selon l’ancienneté du magasin">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2, pt: 3, pb: 1 }}>
        <Typography variant="h3" sx={{ flex: 1 }}>Selon l’ancienneté du magasin</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Hausse tarifaire du réseau</Typography>
          <ChampTaux libelle="Hausse tarifaire du réseau" valeur={cibles.hausseTarifaire} heritee={0}
            onChange={(v) => { const { hausseTarifaire: _, ...reste } = cibles; onChange(v === undefined ? reste : { ...reste, hausseTarifaire: v }) }} />
        </Box>
        {aReprendre.length > 0 && <Button onClick={reprendre} sx={{ minHeight: 48 }}>Reprendre le constaté du réseau</Button>}
      </Box>
      <Table size="small" aria-label="Tickets et panier selon l’ancienneté" sx={{ '& td, & th': { px: 1, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
        <TableHead>
          <TableRow>
            <TableCell>Ancienneté</TableCell>
            <TableCell align="right">Magasins</TableCell>
            {COLONNES.map((k) => <TableCell key={k.libelle} align="right">{k.libelle}{k.cle === 'evolutionPanier' ? ' (en plus des prix)' : ''}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {TRANCHES.map((t) => (
            <TableRow key={t}>
              <TableCell sx={{ fontWeight: 600 }}>{trancheLibelle[t]}</TableCell>
              <TableCell align="right">{magasinsParTranche[t]}</TableCell>
              {COLONNES.map((k) => {
                const c = constat(t, k.cle, k.u)
                return (
                  <TableCell key={k.libelle} align="right" sx={{ py: 0.75 }}>
                    <ChampTaux libelle={`${trancheLibelle[t]} : ${k.cle === 'evolutionFlux' ? 'évolution des tickets' : 'évolution du panier'} ${universLibelle[k.u]}`}
                      valeur={valeur(t, k.cle, k.u)} onChange={(v) => ecrire(t, k.cle, k.u, v)} largeur={110} />
                    <Typography variant="caption" component="div" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.25 }}>
                      {!c ? '' : c.mediane === null ? `Constaté : ${c.magasins} magasin${c.magasins > 1 ? 's' : ''}, trop peu` : `Constaté : ${taux(c.mediane)} (${c.magasins} magasins)`}
                    </Typography>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}

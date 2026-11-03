import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { ecartMilliers, ecartTaux, milliers } from '../lib/format'
import { cheminsVersEbe } from '../moteur/objectifEbe'
import { caPourRemuneration, ebePourRemuneration, type EconomieFranchise } from '../moteur/economie'
import type { Budget } from '../moteur/types'
import { Aide } from './Aide'
import { ChampMontant } from './ChampMontant'
import { styleTableau } from '../theme/tableau'

type Vise = 'ebe' | 'gerant'

// Lot 41, proposition 4, puis Joseph (03/11/2026) : un seul simulateur pour l'objectif d'EBE et la rémunération du gérant
// visée. On vise un montant, l'outil donne ce qu'il faudrait, un levier à la fois. « Appliquer » reporte la valeur dans
// les hypothèses du magasin (à enregistrer ensuite, comme toute saisie). Calculs : moteur (objectifEbe, economie).
export function SimulateurObjectif({ budget, economie, ebeAvec, onAppliquer, lectureSeule }: {
  budget: Budget
  economie: EconomieFranchise
  ebeAvec: (cle: string, x: number) => number
  onAppliquer: (cle: string, x: number) => void
  lectureSeule: boolean
}) {
  const [vise, setVise] = useState<Vise>('ebe')
  const [montant, setMontant] = useState<number | undefined>(undefined)
  const ebeVise = montant === undefined ? undefined : vise === 'ebe' ? montant : ebePourRemuneration(budget.ebe, economie, montant)
  const chemins = ebeVise === undefined ? null : cheminsVersEbe(budget, ebeVise, ebeAvec)
  const caCible = vise === 'gerant' && montant !== undefined ? caPourRemuneration(economie, montant) : null
  const actuel = vise === 'ebe' ? budget.ebe : economie.gerant
  const libelle = vise === 'ebe' ? 'EBE visé' : 'Rémunération du gérant visée'
  return (
    <Card component="section" aria-label="Que faut-il pour…" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 200 }}>
          <Typography variant="h2">Que faut-il pour…</Typography>
          <Aide sujet="simulateur" />
        </Box>
        <ToggleButtonGroup exclusive size="small" value={vise} aria-label="Résultat visé"
          onChange={(_, v: Vise | null) => { if (v) { setVise(v); setMontant(undefined) } }}>
          <ToggleButton value="ebe" sx={{ minHeight: 48, px: 2 }}>Un EBE</ToggleButton>
          <ToggleButton value="gerant" sx={{ minHeight: 48, px: 2 }}>Une rémunération du gérant</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <ChampMontant key={vise} libelle={libelle} valeur={montant ?? 0} largeur={150} unite={vise === 'ebe' ? '€' : '€ par an'} onChange={(v) => setMontant(v || undefined)} />
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {chemins
            ? `Aujourd’hui ${milliers(actuel)} : ${chemins.manque >= 0 ? 'il manque' : 'au-dessus de'} ${milliers(Math.abs(chemins.manque))} d’EBE`
            : vise === 'ebe' ? `EBE du budget : ${milliers(budget.ebe)}` : `Gérant dans le budget : ${milliers(economie.gerant)} par an, charges comprises`}
        </Typography>
      </Box>
      {caCible && Math.abs(chemins?.manque ?? 0) >= 100 && (
        <Typography sx={{ mt: 1.5, fontVariantNumeric: 'tabular-nums' }}>
          CA à atteindre : <b>{milliers(caCible.ca)}</b> ({ecartTaux(caCible.ecart)} sur le budget), à marge et frais inchangés
        </Typography>
      )}
      {chemins && Math.abs(chemins.manque) >= 100 && (
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small" aria-label={`Leviers pour atteindre : ${libelle.toLowerCase()}`} sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell>Levier, seul</TableCell>
                <TableCell align="right">Aujourd’hui</TableCell>
                <TableCell align="right">Il faudrait</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {chemins.leviers.map((l) => (
                <TableRow key={l.cle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell align="right">{ecartTaux(l.actuelle)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{l.valeur === null ? 'Hors de portée' : ecartTaux(l.valeur)}</TableCell>
                  <TableCell align="right">
                    {!lectureSeule && l.valeur !== null && (
                      <Button onClick={() => onAppliquer(l.cle, l.valeur!)} sx={{ minHeight: 48 }} aria-label={`Appliquer : ${l.libelle} ${ecartTaux(l.valeur)}`}>Appliquer</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Payer le gérant davantage en baissant la masse salariale n'a pas de sens : la ligne ne vaut que pour l'EBE */}
              {vise === 'ebe' && (
                <TableRow>
                  <TableCell>Masse salariale</TableCell>
                  <TableCell align="right">{milliers(budget.personnel)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{chemins.masseSalariale === null ? 'Hors de portée' : `${milliers(chemins.masseSalariale)} (${ecartMilliers(chemins.masseSalariale - budget.personnel)})`}</TableCell>
                  <TableCell align="right"><Typography variant="body2" color="text.secondary">Dans l’équipe</Typography></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

import { useState } from 'react'
import Box from '@mui/material/Box'
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
import { chargerComparaison } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { taux } from '../lib/format'
import { medianes, plusHautMieux, rang, RATIOS, ratioLibelle, type CleRatio } from '../moteur/comparaison'

const MIN_MAGASINS = 3   // en dessous, une médiane ne dit rien
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const texte = (k: CleRatio, v: number | null) => (v === null ? '–' : k === 'panierTTC' ? euros.format(v) : taux(v))

// Le magasin face à la médiane de son groupe et du réseau (ou des magasins du compte), sur le réel ou sur les budgets
export function ComparaisonMagasin({ magasin, directeur }: { magasin: string; directeur: boolean }) {
  const { donnees } = useChargement(() => chargerComparaison(), [])
  const [choix, setChoix] = useState<'reel' | 'budget' | null>(null)
  if (!donnees) return null
  const avecReel = donnees.reel.some((r) => r.magasin === magasin) && donnees.reel.length >= MIN_MAGASINS
  const avecBudget = donnees.budget.some((r) => r.magasin === magasin) && donnees.budget.length >= MIN_MAGASINS
  const base = choix ?? (avecReel ? 'reel' : avecBudget ? 'budget' : null)
  if (!base || (base === 'reel' ? !avecReel : !avecBudget)) return null

  const tous = donnees[base]
  const moi = tous.find((r) => r.magasin === magasin)!
  const groupe = moi.groupeId !== null ? donnees.groupes.find((g) => g.id === moi.groupeId) : undefined
  const duGroupe = groupe ? tous.filter((r) => r.groupeId === groupe.id) : []
  const mReseau = medianes(tous.map((r) => r.ratios))
  const mGroupe = duGroupe.length >= MIN_MAGASINS ? medianes(duGroupe.map((r) => r.ratios)) : null
  const nomReseau = directeur ? 'Médiane du réseau' : 'Médiane de tes magasins'
  const couleur = (k: CleRatio, v: number | null, m: number | null) =>
    v === null || m === null || Math.abs(v - m) < 1e-9 ? undefined : (v > m) === plusHautMieux[k] ? 'success.main' : 'error.main'

  return (
    <Card component="section" aria-label="Face au réseau" sx={{ mt: 3 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Face au réseau</Typography>
        {avecReel && avecBudget && (
          <ToggleButtonGroup exclusive size="small" value={base} onChange={(_, v: 'reel' | 'budget' | null) => v && setChoix(v)} aria-label="Chiffres comparés">
            <ToggleButton value="reel" sx={{ minHeight: 48, textTransform: 'none' }}>Réel {donnees.annee} à date</ToggleButton>
            <ToggleButton value="budget" sx={{ minHeight: 48, textTransform: 'none' }}>Budgets {donnees.anneeBudget}</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      <TableContainer>
        <Table size="small" aria-label={`${magasin} face aux médianes`} sx={{ '& td, & th': { whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{base === 'reel' ? `Réel ${donnees.annee} à date` : `Budgets ${donnees.anneeBudget}`}</TableCell>
              <TableCell align="right">Ce magasin</TableCell>
              {mGroupe && <TableCell align="right">Médiane {groupe!.nom}</TableCell>}
              <TableCell align="right">{nomReseau}</TableCell>
              <TableCell align="right">Rang</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {RATIOS.map((k) => {
              const v = moi.ratios[k]
              const r = rang(v, tous.map((x) => x.ratios), k)
              return (
                <TableRow key={k}>
                  <TableCell>{ratioLibelle[k]}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: couleur(k, v, mReseau[k]) }}>{texte(k, v)}</TableCell>
                  {mGroupe && <TableCell align="right">{texte(k, mGroupe[k])}</TableCell>}
                  <TableCell align="right">{texte(k, mReseau[k])}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{r && r.sur >= MIN_MAGASINS ? `${r.rang}${r.rang === 1 ? 'er' : 'e'} sur ${r.sur}` : '–'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

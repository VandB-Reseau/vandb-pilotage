import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import { milliers } from '../lib/format'
import { ChoixListe } from './ChoixListe'
import { THEMES_COPIE, type ThemeCopie } from '../moteur/cibles'
import { TRANCHES, trancheLibelle, type Tranche } from '../moteur/projection'
import { styleTableau } from '../theme/tableau'

// Lot 42 (Joseph, 02/11/2026, proposition 3) : copier les hypothèses d'un magasin modèle vers d'autres, thème par thème.
// Le Directeur choisit les thèmes, filtre les magasins visés (groupe, ancienneté, statut) et voit l'EBE de chacun avant et
// après la copie. Un magasin en discussion n'est jamais coché d'office : ses propres changements seraient remplacés.
export interface Destination { magasin: string; statut: 'propose' | 'en_discussion'; groupe: string; tranche: Tranche | null }

const STATUTS = { propose: 'Proposé', en_discussion: 'En discussion' } as const

export function CopieHypotheses({ source, destinations, ebe, occupe, onCopier, onFermer }: {
  source: string
  destinations: Destination[]
  ebe: (magasin: string, themes: ThemeCopie[]) => { avant: number; apres: number } | null
  occupe: boolean
  onCopier: (vers: string[], themes: ThemeCopie[]) => void
  onFermer: () => void
}) {
  const [themes, setThemes] = useState<ThemeCopie[]>(['ventes', 'marge'])
  const [groupe, setGroupe] = useState('')
  const [tranche, setTranche] = useState('')
  const [statut, setStatut] = useState<'tous' | 'propose' | 'en_discussion'>('propose')
  const [choisis, setChoisis] = useState<string[]>([])
  const groupes = [...new Set(destinations.map((x) => x.groupe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const visibles = destinations.filter((x) => (!groupe || x.groupe === groupe) && (!tranche || x.tranche === tranche) && (statut === 'tous' || x.statut === statut))
  const effets = useMemo(() => Object.fromEntries(visibles.map((x) => [x.magasin, ebe(x.magasin, themes)])), [visibles.map((x) => x.magasin).join('|'), themes.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const coches = choisis.filter((m) => visibles.some((x) => x.magasin === m))
  const tous = coches.length === visibles.length && visibles.length > 0
  const basculer = (m: string) => setChoisis((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]))

  return (
    <Card component="section" className="pas-a-l-impression" aria-labelledby="titre-copie" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Typography id="titre-copie" variant="h2">Copier les hypothèses de {source}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        Seuls les thèmes choisis changent. Travaux et trésorerie au 1er janvier restent ceux de chaque magasin.
      </Typography>

      <Typography component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>Ce qu’on copie</Typography>
      <Box role="group" aria-label="Thèmes à copier" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
        {THEMES_COPIE.map((t) => (
          <FormControlLabel key={t.cle} label={t.libelle} sx={{ minHeight: 48 }}
            control={<Checkbox sx={{ width: 48, height: 48 }} checked={themes.includes(t.cle)} onChange={() => setThemes((l) => (l.includes(t.cle) ? l.filter((x) => x !== t.cle) : [...l, t.cle]))} />} />
        ))}
      </Box>

      <Typography component="h3" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>Vers quels magasins</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={statut} onChange={(_, v) => v && setStatut(v)} aria-label="Statut des budgets visés">
          <ToggleButton value="propose" sx={{ minHeight: 48 }}>Proposés</ToggleButton>
          <ToggleButton value="en_discussion" sx={{ minHeight: 48 }}>En discussion</ToggleButton>
          <ToggleButton value="tous" sx={{ minHeight: 48 }}>Tous</ToggleButton>
        </ToggleButtonGroup>
        {groupes.length > 0 && (
          <ChoixListe libelle="Groupe" valeur={groupe} largeur={220} onChange={setGroupe}
            options={[{ valeur: '', libelle: 'Tous les groupes' }, ...groupes.map((g) => ({ valeur: g, libelle: g }))]} />
        )}
        <ChoixListe libelle="Ancienneté du magasin" valeur={tranche} largeur={220} onChange={setTranche}
          options={[{ valeur: '', libelle: 'Toutes les anciennetés' }, ...TRANCHES.map((t) => ({ valeur: t as string, libelle: trancheLibelle[t] }))]} />
      </Box>

      {visibles.length === 0 ? (
        <Typography variant="body2" sx={{ py: 1 }}>Aucun magasin ne correspond à ces filtres.</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader aria-label="Magasins visés et effet sur l’EBE" sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox sx={{ width: 48, height: 48 }} checked={tous} indeterminate={!tous && coches.length > 0} slotProps={{ input: { 'aria-label': 'Tous les magasins affichés' } }}
                    onChange={() => setChoisis((c) => (tous ? c.filter((m) => !visibles.some((x) => x.magasin === m)) : [...new Set([...c, ...visibles.map((x) => x.magasin)])]))} />
                </TableCell>
                <TableCell>Magasin</TableCell>
                <TableCell>Budget</TableCell>
                <TableCell align="right">EBE avant</TableCell>
                <TableCell align="right">EBE après</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map((x) => {
                const e = effets[x.magasin]
                const ecart = e ? e.apres - e.avant : 0
                return (
                  <TableRow key={x.magasin} hover onClick={() => basculer(x.magasin)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <Checkbox sx={{ width: 48, height: 48 }} checked={coches.includes(x.magasin)} onClick={(ev) => ev.stopPropagation()} onChange={() => basculer(x.magasin)} slotProps={{ input: { 'aria-label': x.magasin } }} />
                    </TableCell>
                    <TableCell>{x.magasin}</TableCell>
                    <TableCell sx={{ color: x.statut === 'en_discussion' ? 'warning.dark' : undefined }}>{STATUTS[x.statut]}</TableCell>
                    <TableCell align="right">{e ? milliers(e.avant) : '–'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: Math.round(ecart / 100) === 0 ? undefined : ecart > 0 ? 'success.dark' : 'error.main' }}>{e ? milliers(e.apres) : '–'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {coches.some((m) => destinations.find((x) => x.magasin === m)?.statut === 'en_discussion') && (
        <Typography variant="body2" color="warning.dark" sx={{ mt: 1 }}>Les magasins en discussion perdent leurs propres choix sur les thèmes copiés.</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
        <Button onClick={onFermer} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" startIcon={<ContentCopyOutlined />} disabled={occupe || coches.length === 0 || themes.length === 0} onClick={() => onCopier(coches, themes)} sx={{ minHeight: 48 }}>
          {coches.length > 1 ? `Copier vers ${coches.length} magasins` : 'Copier'}
        </Button>
      </Box>
    </Card>
  )
}

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { ChampNombre } from './ChampNombre'
import { ChampTaux } from './ChampTaux'
import { Indicateur } from './Indicateur'
import { nombre } from '../import/caisse'
import { ecartMontant, ecartPts, enChiffres, milliers, MOIS_LONGS, taux } from '../lib/format'
import { CATEGORIES, categorieLibelle, type Categorie } from '../moteur/equipe'
import { simuler, type Leviers } from '../moteur/simulation'
import type { Hypotheses, ParametresReseau } from '../moteur/types'

const lu = (t: string) => { const n = nombre(t); return n === null || Number.isNaN(n) ? 0 : n }

// « Et si » sur le budget du magasin : rien n'est enregistré, le budget reste tel quel
export function SimulationMagasin({ hypotheses, parametres, annee, depart }: {
  hypotheses: Hypotheses
  parametres: ParametresReseau
  annee: number
  depart: number
}) {
  const [ca, setCA] = useState<number | undefined>(undefined)
  const [marge, setMarge] = useState('')
  const [loyer, setLoyer] = useState('')
  const [brut, setBrut] = useState('')
  const [heures, setHeures] = useState('35')
  const [categorie, setCategorie] = useState<Categorie>('employe')
  const [moisEntree, setMoisEntree] = useState(1)

  const leviers: Leviers = {
    ca: ca ?? 0, marge: lu(marge) / 100, loyer: lu(loyer),
    embauche: lu(brut) > 0 ? { brutMensuel: lu(brut), heuresHebdo: lu(heures) || 35, categorie, mois: moisEntree } : null,
  }
  const actif = leviers.ca !== 0 || leviers.marge !== 0 || leviers.loyer !== 0 || leviers.embauche !== null
  const s = simuler(hypotheses, parametres, leviers, depart)
  const remettre = () => { setCA(undefined); setMarge(''); setLoyer(''); setBrut(''); setHeures('35'); setCategorie('employe'); setMoisEntree(1) }

  const ecartEBE = s.simule.ebe - s.budget.ebe
  const bas = s.tresorerieSimulee.pointBas
  const euros = (v: number) => enChiffres(Math.round(v))
  // cout : une hausse est défavorable ; pct : écart en points
  const lignes: { libelle: string; budget: number; simule: number; pct?: boolean; cout?: boolean; fort?: boolean }[] = [
    { libelle: 'CA HT', budget: s.budget.ca, simule: s.simule.ca },
    { libelle: 'Marge', budget: s.budget.marge, simule: s.simule.marge },
    { libelle: 'Taux de marge', budget: s.budget.tauxMarge, simule: s.simule.tauxMarge, pct: true },
    { libelle: 'Charges externes', budget: s.budget.chargesExternes, simule: s.simule.chargesExternes, cout: true },
    { libelle: 'Personnel', budget: s.budget.personnel, simule: s.simule.personnel, cout: true },
    { libelle: 'EBE', budget: s.budget.ebe, simule: s.simule.ebe, fort: true },
    { libelle: 'EBE / CA', budget: s.budget.ratios.ebeSurCA, simule: s.simule.ratios.ebeSurCA, pct: true },
    { libelle: 'Résultat net', budget: s.budget.resultatNet, simule: s.simule.resultatNet },
    { libelle: 'Trésorerie au 31 décembre', budget: s.tresorerie.fin, simule: s.tresorerieSimulee.fin, fort: true },
    { libelle: 'Point bas de trésorerie', budget: s.tresorerie.pointBas.montant, simule: bas.montant },
  ]
  const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }

  return (
    <Stack spacing={3}>
      <Card component="section" aria-label="Leviers de la simulation" sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Et si… sur le budget {annee}</Typography>
          <Button startIcon={<RestartAltOutlined />} onClick={remettre} disabled={!actif} sx={{ minHeight: 48 }}>Revenir au budget</Button>
        </Box>
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 600 }}>Activité</Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography sx={{ flex: '1 1 160px' }}>Variation du CA</Typography>
              <ChampTaux libelle="Variation du CA" valeur={ca} onChange={setCA} largeur={140} />
            </Stack>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography sx={{ flex: '1 1 160px' }}>Variation du taux de marge</Typography>
              <ChampNombre libelle="Variation du taux de marge" valeur={marge} unite="pt" largeur={140} onChange={setMarge} />
            </Stack>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography sx={{ flex: '1 1 160px' }}>Hausse du loyer, par an HT</Typography>
              <ChampNombre libelle="Hausse du loyer par an" valeur={loyer} largeur={140} onChange={setLoyer} />
            </Stack>
          </Stack>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 600 }}>Embauche</Typography>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <ChampNombre libelle="Salaire brut mensuel de l’embauche" valeur={brut} largeur={150} onChange={setBrut} />
              <ChampNombre libelle="Heures par semaine de l’embauche" valeur={heures} unite="h" largeur={100} onChange={setHeures} />
            </Stack>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <TextField select size="small" label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)} sx={{ width: 200, ...champ }}>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ minHeight: 48 }}>{categorieLibelle[c]}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Arrivée" value={moisEntree} onChange={(e) => setMoisEntree(Number(e.target.value))} sx={{ width: 160, ...champ }}>
                {MOIS_LONGS.map((m, i) => <MenuItem key={m} value={i + 1} sx={{ minHeight: 48 }}>{m.charAt(0).toUpperCase() + m.slice(1)}</MenuItem>)}
              </TextField>
            </Stack>
          </Stack>
        </Box>
      </Card>

      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Effet de la simulation">
        <Indicateur
          libelle="EBE simulé" valeur={milliers(s.simule.ebe)}
          ecart={actif ? { texte: `${ecartMontant(ecartEBE)} sur le budget`, hausse: ecartEBE >= 0, favorable: ecartEBE >= 0 } : undefined}
          detail={`${taux(s.simule.ratios.ebeSurCA)} du CA`}
        />
        <Indicateur
          libelle="Point bas de trésorerie" valeur={milliers(bas.montant)}
          detail={`En ${MOIS_LONGS[bas.mois]}${s.tresorerieSimulee.moisNegatifs ? `, ${s.tresorerieSimulee.moisNegatifs} mois à découvert` : ''}`}
        />
        <Indicateur libelle="Trésorerie au 31 décembre" valeur={milliers(s.tresorerieSimulee.fin)} detail={`Budget : ${milliers(s.tresorerie.fin)}`} />
      </Stack>

      <Card>
        <TableContainer>
          <Table size="small" aria-label={`Budget ${annee} et simulation`} sx={{ '& td, & th': { whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros HT</Box></TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Simulation</TableCell>
                <TableCell align="right">Écart</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lignes.map((l) => {
                const ecart = l.simule - l.budget
                const texte = l.pct ? taux : euros
                const nul = Math.abs(ecart) < (l.pct ? 0.00005 : 0.5)
                return (
                  <TableRow key={l.libelle} sx={l.fort ? { '& td': { fontWeight: 700, bgcolor: 'background.default' } } : undefined}>
                    <TableCell>{l.libelle}</TableCell>
                    <TableCell align="right">{texte(l.budget)}</TableCell>
                    <TableCell align="right" sx={l.fort && l.simule < 0 ? { color: 'error.main' } : undefined}>{texte(l.simule)}</TableCell>
                    <TableCell align="right" sx={{ color: nul ? 'text.disabled' : (l.cout ? ecart > 0 : ecart < 0) ? 'error.main' : undefined }}>
                      {nul ? '–' : l.pct ? ecartPts(ecart) : ecartMontant(ecart)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  )
}

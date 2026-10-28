import { Fragment } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { milliers, taux } from '../lib/format'
import { cleFamille, ecrireCible, lireCible, niveauLibelle, valeurHeritee, type Cibles, type NiveauCibles } from '../moteur/cibles'
import { UNIVERS, universLibelle, type ResultatFamille } from '../moteur/types'
import { ChampTaux } from './ChampTaux'

// Hypothèses du budget famille par famille, saisies dans la cellule : le CA et la marge de l'an prochain suivent à chaque frappe.
// Marge de l'an prochain : CA × (marge visée − démarque).
// Une valeur propre au magasin ressort (bouton pour reprendre celle du niveau au-dessus) ; sinon, d'où elle vient.
export function GrilleHypotheses({ titre, familles, annee, cibles, auDessus, valeursBase, onChange, lectureSeule }: {
  titre: string
  familles: ResultatFamille[]
  annee: number
  cibles: Cibles
  auDessus: NiveauCibles[]
  valeursBase: Record<string, number>
  onChange: (c: Cibles) => void
  lectureSeule: boolean
}) {
  const ratio = (a: number, b: number) => (b ? a / b : 0)
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

  const cellule = (cle: string, libelle: string, quoi: string) => {
    const propre = lireCible(cibles, cle)
    const herite = valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)
    return (
      <TableCell align="right" sx={{ py: 0.5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ChampTaux libelle={libelle} valeur={propre} heritee={herite?.valeur ?? valeursBase[cle]} desactive={lectureSeule} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} />
          <Box sx={{ width: 64, textAlign: 'left' }}>
            {propre !== undefined && !lectureSeule ? (
              <Tooltip title="Reprendre la valeur du niveau au-dessus">
                <IconButton aria-label={`Reprendre la valeur du niveau au-dessus : ${quoi}`} onClick={() => onChange(ecrireCible(cibles, cle, undefined))} sx={{ width: 48, height: 48, color: 'warning.dark' }}>
                  <RestartAltOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Box component="span" sx={{ fontSize: '0.75rem', color: propre !== undefined ? 'warning.dark' : 'text.secondary', fontWeight: propre !== undefined ? 700 : 400 }}>
                {niveauLibelle[propre !== undefined ? 'magasin' : herite?.source ?? 'base']}
              </Box>
            )}
          </Box>
        </Box>
      </TableCell>
    )
  }
  const totaux = (l: ResultatFamille[]) => {
    const n = somme(l.map((f) => f.atterrissage)), b = somme(l.map((f) => f.objectif)), m = somme(l.map((f) => f.margeObjectif))
    const dem = somme(l.map((f) => f.objectif * (f.demarque ?? 0)))
    return { n, b, m, evolution: ratio(b, n) - 1, visee: ratio(m + dem, b), demarque: ratio(dem, b) }
  }
  const ligneTotal = (libelle: string, t: ReturnType<typeof totaux>, fort: boolean) => (
    <TableRow sx={{ bgcolor: 'background.default', '& td': { bgcolor: 'background.default', fontWeight: 700, ...(fort ? {} : { color: 'text.secondary' }) } }}>
      <TableCell>{libelle}</TableCell>
      <TableCell align="right">{milliers(t.n)}</TableCell>
      <TableCell align="right" sx={{ pr: '82px !important' }}>{taux(t.evolution)}</TableCell>
      <TableCell align="right">{milliers(t.b)}</TableCell>
      <TableCell align="right" sx={{ pr: '82px !important' }}>{taux(t.visee)}</TableCell>
      <TableCell align="right" sx={{ pr: '82px !important' }}>{taux(t.demarque)}</TableCell>
      <TableCell align="right">{milliers(t.m)}</TableCell>
    </TableRow>
  )
  const univers = UNIVERS.filter((u) => familles.some((f) => f.univers === u))

  return (
    <Table size="small" className="colonne-fixe" aria-label={titre} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
      <TableHead>
        <TableRow>
          <TableCell>Famille</TableCell>
          <TableCell align="right">CA {annee - 1} attendu</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}>Évolution</TableCell>
          <TableCell align="right">CA {annee}</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}>Marge visée</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}>Démarque</TableCell>
          <TableCell align="right">Marge {annee}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {univers.map((u) => {
          const l = familles.filter((f) => f.univers === u)
          return (
            <Fragment key={u}>
              {univers.length > 1 && ligneTotal(universLibelle[u], totaux(l), false)}
              {l.map((f) => {
                const nom = `${f.famille} (${universLibelle[f.univers]})`
                return (
                  <TableRow key={cleFamille(f)}>
                    <TableCell sx={{ pl: univers.length > 1 ? '36px !important' : undefined }}>{nom}</TableCell>
                    <TableCell align="right">{milliers(f.atterrissage)}</TableCell>
                    {cellule(`evolution/${cleFamille(f)}`, `Évolution du CA par famille : ${nom}`, `évolution de ${nom}`)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{milliers(f.objectif)}</TableCell>
                    {cellule(`marge/${cleFamille(f)}`, `Marge visée par famille : ${nom}`, `marge visée de ${nom}`)}
                    {cellule(`demarque/${cleFamille(f)}`, `Démarque par famille : ${nom}`, `démarque de ${nom}`)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{milliers(f.margeObjectif)}</TableCell>
                  </TableRow>
                )
              })}
            </Fragment>
          )
        })}
        {ligneTotal('Total', totaux(familles), true)}
      </TableBody>
    </Table>
  )
}

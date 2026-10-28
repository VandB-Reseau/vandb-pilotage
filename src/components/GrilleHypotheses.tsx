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
import { enChiffres, milliers, panier, taux } from '../lib/format'
import { cleFamille, ecrireCible, lireCible, niveauLibelle, valeurHeritee, type Cibles, type NiveauCibles } from '../moteur/cibles'
import { UNIVERS, universLibelle, type Budget, type ResultatFamille } from '../moteur/types'
import { Aide } from './Aide'
import { ChampTaux } from './ChampTaux'

// Hypothèses du budget famille par famille, saisies dans la cellule : le CA et la marge de l'an prochain suivent à chaque frappe.
// Marge de l'an prochain : CA × (marge visée − démarque). Cave et Bar avec leurs tickets (lot 22) : le CA de l'univers se
// règle par l'évolution des tickets et du panier, chaque famille par sa part dans l'univers ; son évolution en découle.
// Une valeur propre au magasin ressort (bouton pour reprendre celle du niveau au-dessus) ; sinon, d'où elle vient.
export function GrilleHypotheses({ titre, familles, flux, annee, cibles, auDessus, valeursBase, onChange, lectureSeule }: {
  titre: string
  familles: ResultatFamille[]
  flux: Budget['flux']
  annee: number
  cibles: Cibles
  auDessus: NiveauCibles[]
  valeursBase: Record<string, number>
  onChange: (c: Cibles) => void
  lectureSeule: boolean
}) {
  const ratio = (a: number, b: number) => (b ? a / b : 0)
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

  const cellule = (cle: string, libelle: string, quoi: string, base = valeursBase[cle]) => {
    const propre = lireCible(cibles, cle)
    const herite = valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)
    return (
      <TableCell align="right" sx={{ py: 0.5 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <ChampTaux libelle={libelle} valeur={propre} heritee={herite?.valeur ?? base} desactive={lectureSeule} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} />
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
      <TableCell />
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
          <TableCell align="right" sx={{ pr: '82px !important' }}><Aide sujet="mix" />Part de l’univers</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}><Aide sujet="evolution" />Évolution</TableCell>
          <TableCell align="right">CA {annee}</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}><Aide sujet="marge" />Marge visée</TableCell>
          <TableCell align="right" sx={{ pr: '82px !important' }}><Aide sujet="demarque" />Démarque</TableCell>
          <TableCell align="right">Marge {annee}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {univers.map((u) => {
          const l = familles.filter((f) => f.univers === u)
          const fl = u === 'exterieur' || !flux[u]?.parTickets ? undefined : flux[u]
          const caU = somme(l.map((f) => f.objectif))
          const nomU = universLibelle[u]
          return (
            <Fragment key={u}>
              {(univers.length > 1 || fl) && ligneTotal(nomU, totaux(l), false)}
              {fl && (
                <>
                  <TableRow>
                    <TableCell sx={{ pl: '36px !important' }}>Tickets ({nomU})<Aide sujet="tickets" /></TableCell>
                    <TableCell align="right">{enChiffres(Math.round(fl.atterrissage))}</TableCell>
                    <TableCell />
                    {cellule(`flux/${u}`, `Évolution du nombre de tickets : ${nomU}`, `évolution des tickets ${nomU}`)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{enChiffres(Math.round(fl.objectif))}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: '36px !important' }}>Panier moyen TTC ({nomU})<Aide sujet="panier" /></TableCell>
                    <TableCell align="right">{panier(fl.panierRealiseTTC)}</TableCell>
                    <TableCell />
                    {cellule(`panier/${u}`, `Évolution du panier moyen : ${nomU}`, `évolution du panier ${nomU}`)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{panier(fl.panierObjectifTTC)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </>
              )}
              {l.map((f) => {
                const nom = `${f.famille} (${nomU})`
                const cle = cleFamille(f)
                return (
                  <TableRow key={cle}>
                    <TableCell sx={{ pl: univers.length > 1 || fl ? '36px !important' : undefined }}>{nom}</TableCell>
                    <TableCell align="right">{milliers(f.atterrissage)}</TableCell>
                    {fl ? cellule(`mix/${cle}`, `Part de la famille dans l’univers : ${nom}`, `part de ${nom}`, ratio(f.objectif, caU))
                      : <TableCell align="right" sx={{ pr: '82px !important', color: 'text.secondary' }}>–</TableCell>}
                    {fl ? <TableCell align="right" sx={{ pr: '82px !important' }}>{taux(ratio(f.objectif, f.atterrissage) - 1)}</TableCell>
                      : cellule(`evolution/${cle}`, `Évolution du CA par famille : ${nom}`, `évolution de ${nom}`)}
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{milliers(f.objectif)}</TableCell>
                    {cellule(`marge/${cle}`, `Marge visée par famille : ${nom}`, `marge visée de ${nom}`)}
                    {cellule(`demarque/${cle}`, `Démarque par famille : ${nom}`, `démarque de ${nom}`)}
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

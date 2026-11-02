import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { taux } from '../lib/format'
import { sujetDeCle } from '../lib/aide'
import { ecrireCible, lireCible, type Cibles, type ValeursMillesime } from '../moteur/cibles'
import { TRANCHES, trancheLibelle, type Calage, type Constat, type Tranche } from '../moteur/projection'
import { UNIVERS, universLibelle, type Univers, type UniversTickets } from '../moteur/types'
import { Aide } from './Aide'
import { ChampTaux } from './ChampTaux'

// Lot 41, proposition 7 (Joseph, 02/11/2026) : les hypothèses du réseau en une seule grille. Une ligne par levier
// (tickets, panier, évolution des univers sans tickets), une colonne pour tous les magasins puis une par ancienneté,
// le constaté du réseau sous chaque case. En tête : hausse tarifaire, hausse des salaires, inflation des frais.
// Les libellés des champs « Tous les magasins » restent ceux du tableau détaillé (mêmes clés, mêmes aides).
type Cle = 'evolutionFlux' | 'evolutionPanier'
interface LigneGrille { cle: string; libelle: string; section: string; millesime?: { cle: Cle; u: UniversTickets } }

export function lignesGrille(parTickets: UniversTickets[]): LigneGrille[] {
  const lignes: LigneGrille[] = []
  for (const u of parTickets) {
    lignes.push({ cle: `flux/${u}`, libelle: `Tickets ${universLibelle[u]}`, section: 'Évolution du nombre de tickets', millesime: { cle: 'evolutionFlux', u } })
    lignes.push({ cle: `panier/${u}`, libelle: `Panier moyen ${universLibelle[u]}`, section: 'Évolution du panier moyen', millesime: { cle: 'evolutionPanier', u } })
  }
  for (const u of UNIVERS.filter((x) => !(parTickets as Univers[]).includes(x))) {
    lignes.push({ cle: `univers/${u}`, libelle: `CA ${universLibelle[u]}`, section: 'Évolution du CA par univers' })
  }
  return lignes
}

export function GrilleCiblesReseau({ cibles, onChange, parTickets, calage, magasinsParTranche }: {
  cibles: Cibles
  onChange: (c: Cibles) => void
  parTickets: UniversTickets[]
  calage: Calage | null
  magasinsParTranche: Record<Tranche, number> | null
}) {
  const lignes = lignesGrille(parTickets)
  const valeurM = (t: Tranche, c: Cle, u: UniversTickets) => cibles.millesimes?.[t]?.[c]?.[u]
  const ecrireM = (t: Tranche, c: Cle, u: UniversTickets, v: number | undefined) => {
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
  const aReprendre = TRANCHES.flatMap((t) => lignes.flatMap((l) => (l.millesime && valeurM(t, l.millesime.cle, l.millesime.u) === undefined && constat(t, l.millesime.cle, l.millesime.u)?.mediane != null ? [{ t, m: l.millesime }] : [])))
  const reprendre = () => {
    let c = cibles
    for (const { t, m: k } of aReprendre) {
      const m = structuredClone(c.millesimes ?? {})
      m[t] = { ...m[t], [k.cle]: { ...m[t]?.[k.cle], [k.u]: constat(t, k.cle, k.u)!.mediane! } }
      c = { ...c, millesimes: m }
    }
    onChange(c)
  }
  const tarif = cibles.hausseTarifaire
  const general = (cle: 'hausseSalaires' | 'inflationFrais', libelle: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{libelle}</Typography>
      <Aide sujet={cle} />
      <ChampTaux libelle={`Salaires et frais : ${libelle}`} valeur={lireCible(cibles, cle)} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} largeur={110} />
    </Box>
  )
  return (
    <Box component="section" aria-label="Grille des hypothèses du réseau">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, flexWrap: 'wrap', px: 2, pt: 1, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Hausse tarifaire</Typography>
          <ChampTaux libelle="Hausse tarifaire du réseau" valeur={tarif} heritee={0} largeur={110}
            onChange={(v) => { const { hausseTarifaire: _, ...reste } = cibles; onChange(v === undefined ? reste : { ...reste, hausseTarifaire: v }) }} />
        </Box>
        {general('hausseSalaires', 'Hausse des salaires')}
        {general('inflationFrais', 'Inflation des frais')}
        {aReprendre.length > 0 && <Button onClick={reprendre} sx={{ minHeight: 48, ml: { md: 'auto' } }}>Reprendre le constaté du réseau</Button>}
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Hypothèses du réseau par ancienneté" sx={{ '& td, & th': { px: 1, whiteSpace: 'nowrap', verticalAlign: 'top' }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Hypothèse</TableCell>
              <TableCell align="right">Tous les magasins</TableCell>
              {parTickets.length > 0 && TRANCHES.map((t) => (
                <TableCell key={t} align="right">
                  {trancheLibelle[t]}
                  {magasinsParTranche && <Typography variant="caption" component="div" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{magasinsParTranche[t]} magasin{magasinsParTranche[t] > 1 ? 's' : ''}</Typography>}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {lignes.map((l) => {
              const sujet = sujetDeCle(l.cle)
              const m = l.millesime
              return (
                <TableRow key={l.cle}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 48 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.libelle}</Typography>
                      {sujet && <Aide sujet={sujet} />}
                    </Box>
                    {m?.cle === 'evolutionPanier' && <Typography variant="caption" component="div" color="text.secondary" sx={{ fontSize: '0.75rem' }}>Par ancienneté : en plus des prix</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 0.75 }}>
                    <ChampTaux libelle={`${l.section} : ${universLibelle[l.cle.split('/')[1] as Univers]}`} valeur={lireCible(cibles, l.cle)}
                      heritee={m?.cle === 'evolutionPanier' ? tarif : undefined} onChange={(v) => onChange(ecrireCible(cibles, l.cle, v))} largeur={110} />
                  </TableCell>
                  {parTickets.length > 0 && TRANCHES.map((t) => {
                    if (!m) return <TableCell key={t} align="right" sx={{ color: 'text.secondary' }}>–</TableCell>
                    const c = constat(t, m.cle, m.u)
                    return (
                      <TableCell key={t} align="right" sx={{ py: 0.75 }}>
                        <ChampTaux libelle={`${trancheLibelle[t]} : ${m.cle === 'evolutionFlux' ? 'évolution des tickets' : 'évolution du panier'} ${universLibelle[m.u]}`}
                          valeur={valeurM(t, m.cle, m.u)} onChange={(v) => ecrireM(t, m.cle, m.u, v)} largeur={110} />
                        <Typography variant="caption" component="div" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.25 }}>
                          {!c ? '' : c.mediane === null ? `Constaté : ${c.magasins} magasin${c.magasins > 1 ? 's' : ''}, trop peu` : `Constaté : ${taux(c.mediane)} (${c.magasins})`}
                        </Typography>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}

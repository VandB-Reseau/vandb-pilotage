import { Fragment } from 'react'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { cleFamille, ecrireCible, lireCible, valeurHeritee, type Cibles, type Niveau, type NiveauCibles } from '../moteur/cibles'
import { UNIVERS, universLibelle, type Famille, type Univers } from '../moteur/types'
import { sujetDeCle } from '../lib/aide'
import { Aide } from './Aide'
import { ChampTaux } from './ChampTaux'
import { SourceCible } from './SourceCible'

export interface LigneCible { cle: string; libelle: string; section: string }

// Hypothèses réglables, rangées par section ; l'évolution par univers ne se règle qu'au réseau et au groupe.
// Cave et Bar (lot 22) : CA par l'évolution des tickets et du panier, familles par leur part dans l'univers.
// L'évolution du CA d'une famille Cave ou Bar ne vaut que pour un magasin sans tickets : elle n'est plus proposée.
export function lignesCibles(familles: Pick<Famille, 'univers' | 'famille'>[], avecUnivers: boolean, flux: ('cave' | 'bar')[] = ['cave', 'bar']): LigneCible[] {
  const lignes: LigneCible[] = []
  const parTickets = (u: Univers) => (flux as Univers[]).includes(u)
  const nomDe = (cle: string) => { const [u, ...n] = cle.split('/'); return `${n.join('/')} (${universLibelle[u as Univers]})` }
  for (const u of flux) lignes.push({ cle: `flux/${u}`, libelle: universLibelle[u], section: 'Évolution du nombre de tickets' })
  for (const u of flux) lignes.push({ cle: `panier/${u}`, libelle: universLibelle[u], section: 'Évolution du panier moyen' })
  if (avecUnivers) for (const u of UNIVERS.filter((x) => !parTickets(x))) lignes.push({ cle: `univers/${u}`, libelle: universLibelle[u], section: 'Évolution du CA par univers' })
  const vues: string[] = []
  for (const f of [...familles].sort((a, b) => UNIVERS.indexOf(a.univers) - UNIVERS.indexOf(b.univers) || a.famille.localeCompare(b.famille, 'fr'))) {
    const cle = cleFamille(f)
    if (!vues.includes(cle)) vues.push(cle)
  }
  for (const cle of vues) {
    const u = cle.split('/')[0] as Univers
    if (parTickets(u)) lignes.push({ cle: `mix/${cle}`, libelle: nomDe(cle), section: 'Part de la famille dans son univers' })
  }
  for (const cle of vues) if (!parTickets(cle.split('/')[0] as Univers)) lignes.push({ cle: `evolution/${cle}`, libelle: nomDe(cle), section: 'Évolution du CA par famille' })
  for (const cle of vues) lignes.push({ cle: `marge/${cle}`, libelle: nomDe(cle), section: 'Marge visée par famille' })
  for (const cle of vues) lignes.push({ cle: `demarque/${cle}`, libelle: nomDe(cle), section: 'Démarque par famille' })
  lignes.push({ cle: 'hausseSalaires', libelle: 'Hausse des salaires', section: 'Salaires et frais' })
  lignes.push({ cle: 'inflationFrais', libelle: 'Inflation des frais', section: 'Salaires et frais' })
  return lignes
}

export function TableauCibles({ titre, lignes, niveau, cibles, auDessus, valeursBase, onChange, lectureSeule }: {
  titre: string
  lignes: LigneCible[]
  niveau: Niveau
  cibles: Cibles
  auDessus: NiveauCibles[]
  valeursBase?: Record<string, number> // valeur sans aucune cible (réalisé du magasin)
  onChange: (c: Cibles) => void
  lectureSeule?: boolean
}) {
  const sections = [...new Set(lignes.map((l) => l.section))]
  return (
    <Table size="small" aria-label={titre}>
      <TableHead>
        <TableRow>
          <TableCell>Hypothèse</TableCell>
          <TableCell align="right">Valeur</TableCell>
          <TableCell>Origine</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sections.map((s) => (
          <Fragment key={s}>
            <TableRow>
              <TableCell colSpan={3} sx={{ fontWeight: 700, bgcolor: 'background.default' }}>
                {s}
                {(() => { const sujet = sujetDeCle(lignes.find((l) => l.section === s)!.cle); return sujet && <Aide sujet={sujet} /> })()}
              </TableCell>
            </TableRow>
            {lignes.filter((l) => l.section === s).map((l) => {
              const propre = lireCible(cibles, l.cle)
              // Sans valeur propre : celle du niveau au-dessus, ou de l'univers au même niveau
              const herite = valeurHeritee([...auDessus, { niveau, cibles: ecrireCible(cibles, l.cle, undefined) }], l.cle)
              const source = propre !== undefined ? niveau : herite?.source ?? 'base'
              const libelle = `${s} : ${l.libelle}`
              return (
                <TableRow key={l.cle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell align="right">
                    <ChampTaux libelle={libelle} valeur={propre} heritee={herite?.valeur ?? valeursBase?.[l.cle]} desactive={lectureSeule}
                      onChange={(v) => onChange(ecrireCible(cibles, l.cle, v))} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <SourceCible source={source} />
                    {propre !== undefined && !lectureSeule && (
                      <Tooltip title="Reprendre la valeur du niveau au-dessus">
                        <IconButton aria-label={`Reprendre la valeur du niveau au-dessus : ${l.libelle}`} onClick={() => onChange(ecrireCible(cibles, l.cle, undefined))} sx={{ width: 48, height: 48, ml: 0.5 }}>
                          <RestartAltOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}

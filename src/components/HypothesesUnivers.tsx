import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { enChiffres, milliers, panier, taux } from '../lib/format'
import type { AIDE } from '../lib/aide'
import {
  cleFamille, ecrireCible, ecrireUnivers, lireCible, moyenneUnivers, niveauLibelle, universRegle, valeurHeritee,
  type Cibles, type NiveauCibles, type ReglageUnivers,
} from '../moteur/cibles'
import { UNIVERS, universLibelle, type Budget, type ResultatFamille, type Univers } from '../moteur/types'
import { styleTableau } from '../theme/tableau'
import { Aide } from './Aide'
import { ChampTaux } from './ChampTaux'
import { GrilleHypotheses } from './GrilleHypotheses'

// Lot 37 (Joseph, 02/11/2026, « simple comme H1 ») : chaque hypothèse sur une ligne, de l'année en cours à l'an prochain :
// valeur de l'année en cours, proposition du siège, choix du magasin, valeur de l'an prochain. Le détail par famille ne
// s'ouvre qu'à la demande. Marge et démarque de l'univers écrivent la valeur de chaque famille (moteur : ecrireUnivers).
type Commun = {
  cibles: Cibles
  auDessus: NiveauCibles[]
  valeursBase: Record<string, number>
  onChange: (c: Cibles) => void
  lectureSeule: boolean
}

const gris = { color: 'text.secondary' }
const dixieme = (v: number) => Math.round(v * 1000) / 1000

// Ligne d'une hypothèse
function Ligne({ nom, aide, avant, origine, champ, apres }: { nom: string; aide?: keyof typeof AIDE; avant?: ReactNode; origine: ReactNode; champ: ReactNode; apres?: ReactNode }) {
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>{nom}{aide && <Aide sujet={aide} />}</Box>
      </TableCell>
      <TableCell align="right" sx={gris}>{avant ?? '–'}</TableCell>
      <TableCell sx={gris}>{origine}</TableCell>
      <TableCell sx={{ py: 0.5 }}>{champ}</TableCell>
      <TableCell align="right" sx={{ fontWeight: 600 }}>{apres ?? '–'}</TableCell>
    </TableRow>
  )
}

function Reprendre({ quoi, texte, onClick }: { quoi: string; texte: string; onClick: () => void }) {
  return (
    <Button size="small" onClick={onClick} aria-label={`Reprendre la valeur du niveau au-dessus : ${quoi}`}
      sx={{ fontSize: '0.8125rem', fontWeight: 600, minHeight: 48, py: 0, px: 0.5, minWidth: 0, textTransform: 'none', justifyContent: 'flex-start' }}>
      {texte} · reprendre
    </Button>
  )
}

// Tableau d'hypothèses : en-tête commun à tous les thèmes
export function TableauHypotheses({ titre, annee, children }: { titre: string; annee: number; children: ReactNode }) {
  return (
    <TableContainer>
      {/* Mêmes largeurs de colonnes dans tous les tableaux d'hypothèses : les univers se lisent l'un sous l'autre */}
      <Table size="small" className="colonne-fixe" aria-label={titre} sx={{
        ...styleTableau, tableLayout: { xs: 'auto', md: 'fixed' }, minWidth: { md: 680 }, '& td, & th': { ...styleTableau['& td, & th'], whiteSpace: 'normal' },
        // Téléphone : sans la colonne de l'année en cours, le tableau tient dans l'écran
        '& tr > *:nth-child(2)': { display: { xs: 'none', md: 'table-cell' } }, '& td, & th:not([scope=row])': { px: { xs: 0.5, md: 1.25 } }, '& th[scope=row]': { pl: { xs: 1.5, md: 2.5 } },
      }}>
        <Box component="colgroup" sx={{ display: { xs: 'none', md: 'table-column-group' } }}><col style={{ width: '24%' }} /><col style={{ width: '13%' }} /><col style={{ width: '22%' }} /><col style={{ width: '17%' }} /><col style={{ width: '24%' }} /></Box>
        <TableHead>
          <TableRow>
            <TableCell>Hypothèse</TableCell>
            <TableCell align="right">{annee - 1}</TableCell>
            <TableCell>Siège propose</TableCell>
            <TableCell>Choix du magasin</TableCell>
            <TableCell align="right">{annee}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </TableContainer>
  )
}

// Une hypothèse lue et écrite par sa clé (tickets, panier, évolution d'un univers, salaires, frais)
export function HypotheseCle({ cle, nom, libelle, quoi, aide, avant, apres, cibles, auDessus, valeursBase, onChange, lectureSeule }: Commun & {
  cle: string; nom: string; libelle: string; quoi: string; aide: keyof typeof AIDE; avant?: ReactNode; apres?: ReactNode
}) {
  const propre = lireCible(cibles, cle)
  const herite = valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)
  const auDessusValeur = herite?.valeur ?? valeursBase[cle] ?? 0 // sans cible ni réalisé : rien ne bouge
  const source = `${niveauLibelle[herite?.source ?? 'base']} ${taux(auDessusValeur)}`
  return (
    <Ligne nom={nom} aide={aide} avant={avant} apres={apres}
      champ={<ChampTaux largeur={96} libelle={libelle} valeur={propre} heritee={auDessusValeur} desactive={lectureSeule} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} />}
      origine={propre !== undefined && !lectureSeule
        ? <Reprendre quoi={quoi} texte={source} onClick={() => onChange(ecrireCible(cibles, cle, undefined))} />
        : source}
    />
  )
}

type Props = Commun & { familles: ResultatFamille[]; flux: Budget['flux']; annee: number }

export function HypothesesUnivers({ familles, flux, annee, ...commun }: Props) {
  const { cibles, auDessus, onChange, lectureSeule } = commun
  const [ouverts, setOuverts] = useState<Partial<Record<Univers, boolean>>>({})
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

  // Marge et démarque d'un univers : moyenne de ses familles ; une saisie s'applique à toutes
  const parUnivers = (u: Univers, type: ReglageUnivers, nomU: string) => {
    const l = familles.filter((f) => f.univers === u)
    const regle = universRegle(cibles, familles, u, type)
    const moyenne = moyenneUnivers(familles, u, type)
    const sources = new Set(l.map((f) => {
      const cle = `${type}/${cleFamille(f)}`
      return niveauLibelle[valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)?.source ?? 'base']
    }))
    const origine = sources.size === 1 ? [...sources][0] : 'Selon la famille'
    const nom = type === 'marge' ? 'Marge visée' : 'Démarque'
    const ca = somme(l.map((f) => f.caRealise))
    const perte = somme(l.map((f) => f.objectif * (f.demarque ?? 0)))
    const margeConnue = somme(l.map((f) => f.margeRealisee))
    return (
      <Ligne key={type} nom={nom} aide={type === 'marge' ? 'margeUnivers' : 'demarqueUnivers'}
        // Marge de l'année en cours inconnue (réel importé sans marge) : un tiret, pas 0 %
        avant={type === 'marge' && ca && margeConnue ? taux(margeConnue / ca) : undefined}
        // Moyenne des familles arrondie au dixième de point : « 38,0 % », jamais « 38,0214 » coupé dans le champ
        champ={<ChampTaux largeur={96} libelle={`${nom} : ${nomU}`} valeur={regle ? dixieme(moyenne) : undefined} heritee={dixieme(moyenne)} desactive={lectureSeule}
          onChange={(v) => onChange(ecrireUnivers(cibles, familles, u, type, v))} />}
        apres={type === 'marge' ? `${milliers(somme(l.map((f) => f.objectif * f.margeCible)))} avant démarque` : (perte ? `${milliers(perte)} perdus` : 'Aucune perte prévue')}
        origine={regle && !lectureSeule
          ? <Reprendre quoi={`${type === 'marge' ? 'marge visée' : 'démarque'} ${nomU}`} texte={origine === 'Magasin' ? 'Niveau au-dessus' : origine} onClick={() => onChange(ecrireUnivers(cibles, familles, u, type, undefined))} />
          : `${origine} ${taux(moyenne)}`}
      />
    )
  }

  const univers = UNIVERS.filter((u) => familles.some((f) => f.univers === u))
  return (
    <Box>
      {univers.map((u) => {
        const l = familles.filter((f) => f.univers === u)
        const fl = u === 'exterieur' || !flux[u]?.parTickets ? undefined : flux[u]
        const nomU = universLibelle[u]
        const n = somme(l.map((f) => f.atterrissage)), b = somme(l.map((f) => f.objectif)), m = somme(l.map((f) => f.margeObjectif))
        // Une famille réglée à part (part, évolution) : le détail le signale
        const aPart = l.some((f) => ['mix', 'evolution'].some((t) => lireCible(cibles, `${t}/${cleFamille(f)}`) !== undefined))
        const ouvert = !!ouverts[u]
        const cle = (c: string, nom: string, libelle: string, quoi: string, aide: keyof typeof AIDE, avant?: ReactNode, apres?: ReactNode) => (
          <HypotheseCle key={c} cle={c} nom={nom} libelle={libelle} quoi={quoi} aide={aide} avant={avant} apres={apres} {...commun} />
        )
        return (
          <Box key={u} component="section" aria-label={nomU} sx={{ pt: 2, pb: 1, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2, rowGap: 0.5, mb: 1, px: 2.5 }}>
              <Typography variant="h3" sx={{ fontSize: '1.125rem' }}>{nomU}</Typography>
              <Typography sx={{ fontSize: '0.9375rem' }}>
                <Box component="span" sx={gris}>{milliers(n)} → </Box>
                <Box component="span" sx={{ fontWeight: 700 }}>{milliers(b)}</Box>
                <Box component="span" sx={{ color: !n || Math.round(b) === Math.round(n) ? 'text.secondary' : b > n ? 'success.dark' : 'error.dark', fontWeight: 600 }}>{n ? ` (${b >= n ? '+' : ''}${taux(b / n - 1)})` : ''}</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', ...gris }}>Marge {annee} : {milliers(m)}{b ? ` · ${taux(m / b)}` : ''}</Typography>
            </Box>
            <TableauHypotheses titre={`Hypothèses ${annee} : ${nomU}`} annee={annee}>
              {fl ? (
                <>
                  {cle(`flux/${u}`, 'Tickets', `Évolution du nombre de tickets : ${nomU}`, `évolution des tickets ${nomU}`, 'tickets',
                    enChiffres(Math.round(fl.atterrissage)), enChiffres(Math.round(fl.objectif)))}
                  {cle(`panier/${u}`, 'Panier moyen TTC', `Évolution du panier moyen : ${nomU}`, `évolution du panier ${nomU}`, 'panier',
                    panier(fl.panierRealiseTTC), panier(fl.panierObjectifTTC))}
                </>
              ) : cle(`univers/${u}`, 'Évolution du CA', `Évolution du CA par univers : ${nomU}`, `évolution du CA ${nomU}`, 'univers', milliers(n), milliers(b))}
              {parUnivers(u, 'marge', nomU)}
              {parUnivers(u, 'demarque', nomU)}
            </TableauHypotheses>
            <Button onClick={() => setOuverts({ ...ouverts, [u]: !ouvert })} aria-expanded={ouvert} className="pas-a-l-impression"
              endIcon={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ mt: 0.5, ml: 1.5, minHeight: 48 }}>
              Détail par famille ({l.length})
              {aPart && <Box component="span" sx={{ ml: 1, fontWeight: 400, ...gris }}>réglé famille par famille</Box>}
            </Button>
            {ouvert && (
              <TableContainer>
                <GrilleHypotheses detail titre={`Familles : ${nomU}`} familles={l} flux={flux} annee={annee} {...commun} />
              </TableContainer>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

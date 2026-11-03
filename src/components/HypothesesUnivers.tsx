import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { ecartMilliers, enChiffres, milliers, panier, taux } from '../lib/format'
import { effetsUnivers } from '../moteur/effetsHypotheses'
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

// Ligne d'une hypothèse. Refonte A (Joseph, 02/11/2026) : lignes basses sur PC, la proposition du siège seulement quand
// elle existe, « reprendre » en petite flèche à côté du champ, et l'effet en euros quand le tableau en a la colonne.
function Ligne({ nom, aide, avant, origine, champ, reprendre, apres, effet }: {
  nom: string; aide?: keyof typeof AIDE; avant?: ReactNode; origine: ReactNode; champ: ReactNode; reprendre?: ReactNode; apres?: ReactNode; effet?: ReactNode
}) {
  return (
    <TableRow>
      <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>{nom}{aide && <Aide sujet={aide} compact />}</Box>
      </TableCell>
      <TableCell align="right" sx={gris}>{avant ?? '–'}</TableCell>
      <TableCell sx={gris}>{origine}</TableCell>
      <TableCell sx={{ py: 0.5 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>{champ}{reprendre}</Box></TableCell>
      <TableCell align="right" sx={{ fontWeight: 600 }}>{apres ?? '–'}</TableCell>
      {effet !== undefined && <TableCell align="right" className="effet">{effet}</TableCell>}
    </TableRow>
  )
}

function Reprendre({ quoi, texte, onClick }: { quoi: string; texte: string; onClick: () => void }) {
  return (
    <Tooltip title={`Reprendre : ${texte}`}>
      <IconButton onClick={onClick} aria-label={`Reprendre la valeur du niveau au-dessus : ${quoi}`} color="primary"
        sx={{ width: { xs: 48, md: 32 }, height: { xs: 48, md: 32 } }}>
        <ReplayOutlined sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  )
}

// Effet d'une hypothèse : « +14 k€ de CA », vert en hausse, rouge en baisse ; rien quand il est nul ou inconnu
export function Effet({ montant, quoi }: { montant: number | null; quoi: string }) {
  if (montant === null || Math.round(montant / 100) === 0) return <Box component="span" sx={gris}>–</Box>
  return <Box component="span" sx={{ fontWeight: 600, color: montant > 0 ? 'success.dark' : 'error.dark' }}>{ecartMilliers(montant)} {quoi}</Box>
}

// Tableau d'hypothèses : en-tête commun à tous les thèmes
export function TableauHypotheses({ titre, annee, effet, children }: { titre: string; annee: number; effet?: boolean; children: ReactNode }) {
  return (
    <TableContainer>
      {/* Mêmes largeurs de colonnes dans tous les tableaux d'hypothèses : les univers se lisent l'un sous l'autre */}
      <Table size="small" className="colonne-fixe" aria-label={titre} sx={{
        ...styleTableau, tableLayout: { xs: 'auto', md: 'fixed' }, minWidth: { md: 680 }, '& td, & th': { ...styleTableau['& td, & th'], whiteSpace: 'normal' },
        // Téléphone : sans l'année en cours, la proposition du siège (grisée dans le champ) ni l'effet, le tableau tient dans l'écran
        '& tr > *:nth-child(2), & tr > *:nth-child(3), & tr > *:nth-child(6)': { display: { xs: 'none', md: 'table-cell' } }, '& td, & th:not([scope=row])': { px: { xs: 0.5, md: 1.25 } }, '& th[scope=row]': { pl: { xs: 1.5, md: 2.5 } },
      }}>
        <Box component="colgroup" sx={{ display: { xs: 'none', md: 'table-column-group' } }}>{(effet ? ['21%', '12%', '17%', '17%', '18%', '15%'] : ['24%', '13%', '22%', '17%', '24%']).map((l, i) => <col key={i} style={{ width: l }} />)}</Box>
        <TableHead>
          <TableRow>
            <TableCell>Hypothèse</TableCell>
            <TableCell align="right">{annee - 1}</TableCell>
            <TableCell>Siège propose</TableCell>
            <TableCell>Choix du magasin</TableCell>
            <TableCell align="right">{annee}</TableCell>
            {effet && <TableCell align="right">Effet</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </TableContainer>
  )
}

// Une hypothèse lue et écrite par sa clé (tickets, panier, évolution d'un univers, salaires, frais)
export function HypotheseCle({ cle, nom, libelle, quoi, aide, avant, apres, effet, cibles, auDessus, valeursBase, onChange, lectureSeule }: Commun & {
  cle: string; nom: string; libelle: string; quoi: string; aide: keyof typeof AIDE; avant?: ReactNode; apres?: ReactNode; effet?: ReactNode
}) {
  const propre = lireCible(cibles, cle)
  const herite = valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)
  const auDessusValeur = herite?.valeur ?? valeursBase[cle] ?? 0 // sans cible ni réalisé : rien ne bouge
  // Sans proposition du siège (valeur reprise du réalisé) : « Rythme actuel »
  const source = herite ? `${niveauLibelle[herite.source]} ${taux(auDessusValeur)}` : 'Rythme actuel'
  return (
    <Ligne nom={nom} aide={aide} avant={avant} apres={apres} effet={effet} origine={source}
      champ={<ChampTaux compact largeur={96} libelle={libelle} valeur={propre} heritee={auDessusValeur} desactive={lectureSeule} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} />}
      reprendre={propre !== undefined && !lectureSeule ? <Reprendre quoi={quoi} texte={source === 'Rythme actuel' ? `rythme actuel, ${taux(auDessusValeur)}` : source} onClick={() => onChange(ecrireCible(cibles, cle, undefined))} /> : undefined}
    />
  )
}

// Lot 43 : « suite », les lignes Salaires et frais, réglées ici seulement (plus dans les écrans Équipe et Frais)
type Props = Commun & { familles: ResultatFamille[]; flux: Budget['flux']; annee: number; suite?: ReactNode }

export function HypothesesUnivers({ familles, flux, annee, suite, ...commun }: Props) {
  const { cibles, auDessus, onChange, lectureSeule } = commun
  const [ouverts, setOuverts] = useState<Partial<Record<Univers, boolean>>>({})
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

  // Marge et démarque d'un univers : moyenne de ses familles ; une saisie s'applique à toutes
  const parUnivers = (u: Univers, type: ReglageUnivers, nomU: string, effet: ReactNode) => {
    const l = familles.filter((f) => f.univers === u)
    const regle = universRegle(cibles, familles, u, type)
    const moyenne = moyenneUnivers(familles, u, type)
    const sources = new Set(l.map((f) => {
      const cle = `${type}/${cleFamille(f)}`
      return niveauLibelle[valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)?.source ?? 'base']
    }))
    const origine = sources.size === 1 ? [...sources][0] : 'Selon la famille'
    // Sans proposition du siège : la valeur actuelle du magasin
    const origineTexte = origine === niveauLibelle.base ? (type === 'marge' ? 'Marge actuelle' : 'Démarque actuelle') : origine
    const nom = type === 'marge' ? 'Marge visée' : 'Démarque'
    const ca = somme(l.map((f) => f.caRealise))
    const perte = somme(l.map((f) => f.objectif * (f.demarque ?? 0)))
    // margeRealisee est un taux : la marge de l'univers pondère chaque famille par son CA
    const margeConnue = somme(l.map((f) => f.caRealise * f.margeRealisee))
    return (
      <Ligne key={type} nom={nom} aide={type === 'marge' ? 'margeUnivers' : 'demarqueUnivers'} effet={effet}
        // Marge de l'année en cours inconnue (réel importé sans marge) : un tiret, pas 0 %
        avant={type === 'marge' && ca && margeConnue ? taux(margeConnue / ca) : undefined}
        // Moyenne des familles arrondie au dixième de point : « 38,0 % », jamais « 38,0214 » coupé dans le champ
        champ={<ChampTaux compact largeur={96} libelle={`${nom} : ${nomU}`} valeur={regle ? dixieme(moyenne) : undefined} heritee={dixieme(moyenne)} desactive={lectureSeule}
          onChange={(v) => onChange(ecrireUnivers(cibles, familles, u, type, v))} />}
        apres={type === 'marge' ? `${milliers(somme(l.map((f) => f.objectif * f.margeCible)))} avant démarque` : (perte ? `${milliers(perte)} perdus` : 'Aucune perte prévue')}
        origine={regle ? origineTexte : `${origineTexte} ${taux(moyenne)}`}
        reprendre={regle && !lectureSeule
          ? <Reprendre quoi={`${type === 'marge' ? 'marge visée' : 'démarque'} ${nomU}`} texte={origineTexte} onClick={() => onChange(ecrireUnivers(cibles, familles, u, type, undefined))} />
          : undefined}
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
        // Colonne « Effet » (Joseph, 02/11/2026) : calculée par le moteur
        const ef = effetsUnivers({
          caAvant: n, caApres: b, ticketsAvant: fl?.atterrissage, ticketsApres: fl?.objectif,
          margeAvant: somme(l.map((f) => f.caRealise * f.margeRealisee)), caMargeAvant: somme(l.map((f) => f.caRealise)),
          margeApres: somme(l.map((f) => f.objectif * f.margeCible)), perte: somme(l.map((f) => f.objectif * (f.demarque ?? 0))),
        })
        const cle = (c: string, nom: string, libelle: string, quoi: string, aide: keyof typeof AIDE, avant?: ReactNode, apres?: ReactNode, effet?: ReactNode) => (
          <HypotheseCle key={c} cle={c} nom={nom} libelle={libelle} quoi={quoi} aide={aide} avant={avant} apres={apres} effet={effet} {...commun} />
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
            <TableauHypotheses titre={`Hypothèses ${annee} : ${nomU}`} annee={annee} effet>
              {fl ? (
                <>
                  {cle(`flux/${u}`, 'Tickets', `Évolution du nombre de tickets : ${nomU}`, `évolution des tickets ${nomU}`, 'tickets',
                    enChiffres(Math.round(fl.atterrissage)), enChiffres(Math.round(fl.objectif)), <Effet montant={ef.tickets} quoi="de CA" />)}
                  {cle(`panier/${u}`, 'Panier moyen TTC', `Évolution du panier moyen : ${nomU}`, `évolution du panier ${nomU}`, 'panier',
                    panier(fl.panierRealiseTTC), panier(fl.panierObjectifTTC), <Effet montant={ef.panier} quoi="de CA" />)}
                </>
              ) : cle(`univers/${u}`, 'Évolution du CA', `Évolution du CA par univers : ${nomU}`, `évolution du CA ${nomU}`, 'univers', milliers(n), milliers(b), <Effet montant={ef.ca} quoi="de CA" />)}
              {parUnivers(u, 'marge', nomU, <Effet montant={ef.marge} quoi="de marge" />)}
              {parUnivers(u, 'demarque', nomU, <Effet montant={ef.demarque} quoi="de marge" />)}
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
      {suite && (
        <Box component="section" aria-label="Salaires et frais" sx={{ pt: 2, pb: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="h3" sx={{ fontSize: '1.125rem', mb: 1, px: 2.5 }}>Salaires et frais</Typography>
          <TableauHypotheses titre={`Hypothèses ${annee} : salaires et frais`} annee={annee} effet>{suite}</TableauHypotheses>
        </Box>
      )}
    </Box>
  )
}

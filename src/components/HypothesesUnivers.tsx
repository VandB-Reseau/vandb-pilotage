import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import TableContainer from '@mui/material/TableContainer'
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
import { Aide } from './Aide'
import { ChampTaux } from './ChampTaux'
import { GrilleHypotheses } from './GrilleHypotheses'

// Lot 31 : hypothèses du budget réglées par univers, en quelques leviers (tickets, panier, marge, démarque), chacun avec
// son effet sous le champ. Le détail par famille ne s'ouvre qu'à la demande. Marge et démarque de l'univers écrivent la
// valeur de chaque famille (moteur : ecrireUnivers) ; tickets, panier et évolution de l'Extérieur sont déjà par univers.
type Props = {
  familles: ResultatFamille[]
  flux: Budget['flux']
  annee: number
  cibles: Cibles
  auDessus: NiveauCibles[]
  valeursBase: Record<string, number>
  onChange: (c: Cibles) => void
  lectureSeule: boolean
}

// Un levier : son nom, le champ, ce qu'il donne, d'où vient la valeur
function Levier({ nom, aide, champ, effet, origine }: { nom: string; aide?: keyof typeof AIDE; champ: ReactNode; effet?: ReactNode; origine: ReactNode }) {
  return (
    <Box role="group" aria-label={nom} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography component="span" sx={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>{nom}{aide && <Aide sujet={aide} />}</Typography>
      {champ}
      {effet && <Typography component="span" sx={{ fontSize: '0.875rem' }}>{effet}</Typography>}
      <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{origine}</Box>
    </Box>
  )
}

function Reprendre({ quoi, texte, onClick }: { quoi: string; texte: string; onClick: () => void }) {
  return (
    <Button size="small" color="warning" onClick={onClick} aria-label={`Reprendre la valeur du niveau au-dessus : ${quoi}`}
      sx={{ fontSize: '0.75rem', fontWeight: 600, minHeight: { xs: 48, md: 24 }, py: 0, px: 0.5, minWidth: 0, textTransform: 'none', justifyContent: 'flex-start' }}>
      {texte} · reprendre
    </Button>
  )
}

const grille = { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, columnGap: 2, rowGap: 2.5 }

export function HypothesesUnivers({ familles, flux, annee, cibles, auDessus, valeursBase, onChange, lectureSeule }: Props) {
  const [ouverts, setOuverts] = useState<Partial<Record<Univers, boolean>>>({})
  const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

  // Levier lu et écrit par sa clé (tickets, panier, évolution d'un univers, salaires, frais), comme dans la grille
  const parCle = (cle: string, nom: string, libelle: string, quoi: string, aide: keyof typeof AIDE, effet?: ReactNode) => {
    const propre = lireCible(cibles, cle)
    const herite = valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)
    const auDessusValeur = herite?.valeur ?? valeursBase[cle] ?? 0 // sans cible ni réalisé : rien ne bouge
    const source = niveauLibelle[herite?.source ?? 'base']
    return (
      <Levier key={cle} nom={nom} aide={aide} effet={effet}
        champ={<ChampTaux libelle={libelle} valeur={propre} heritee={auDessusValeur} desactive={lectureSeule} marque={propre !== undefined} onChange={(v) => onChange(ecrireCible(cibles, cle, v))} />}
        origine={propre !== undefined
          ? (lectureSeule ? 'Magasin' : <Reprendre quoi={quoi} texte={`${source}${auDessusValeur !== undefined ? ` ${taux(auDessusValeur)}` : ''}`} onClick={() => onChange(ecrireCible(cibles, cle, undefined))} />)
          : source}
      />
    )
  }

  // Marge et démarque d'un univers : moyenne de ses familles ; une saisie s'applique à toutes
  const parUnivers = (u: Univers, type: ReglageUnivers, nomU: string) => {
    const regle = universRegle(cibles, familles, u, type)
    const moyenne = moyenneUnivers(familles, u, type)
    const l = familles.filter((f) => f.univers === u)
    const sources = new Set(l.map((f) => {
      const cle = `${type}/${cleFamille(f)}`
      return niveauLibelle[valeurHeritee([...auDessus, { niveau: 'magasin', cibles: ecrireCible(cibles, cle, undefined) }], cle)?.source ?? 'base']
    }))
    const origine = sources.size === 1 ? [...sources][0] : 'Selon la famille'
    const nom = type === 'marge' ? 'Marge visée' : 'Démarque'
    const quoi = `${type === 'marge' ? 'marge visée' : 'démarque'} ${nomU}`
    return (
      <Levier key={type} nom={nom} aide={type === 'marge' ? 'margeUnivers' : 'demarqueUnivers'}
        champ={<ChampTaux libelle={`${nom} : ${nomU}`} valeur={regle ? moyenne : undefined} heritee={moyenne} desactive={lectureSeule} marque={regle}
          onChange={(v) => onChange(ecrireUnivers(cibles, familles, u, type, v))} />}
        effet={type === 'marge' ? `${milliers(somme(l.map((f) => f.objectif * f.margeCible)))} avant démarque` : (somme(l.map((f) => f.objectif * (f.demarque ?? 0))) ? `${milliers(somme(l.map((f) => f.objectif * (f.demarque ?? 0))))} perdus` : 'Aucune perte prévue')}
        origine={regle ? (lectureSeule ? 'Magasin' : <Reprendre quoi={quoi} texte={origine === 'Magasin' ? 'Niveau au-dessus' : origine} onClick={() => onChange(ecrireUnivers(cibles, familles, u, type, undefined))} />) : origine}
      />
    )
  }

  const univers = UNIVERS.filter((u) => familles.some((f) => f.univers === u))
  return (
    <Box>
      {univers.map((u, i) => {
        const l = familles.filter((f) => f.univers === u)
        const fl = u === 'exterieur' || !flux[u]?.parTickets ? undefined : flux[u]
        const nomU = universLibelle[u]
        const n = somme(l.map((f) => f.atterrissage)), b = somme(l.map((f) => f.objectif)), m = somme(l.map((f) => f.margeObjectif))
        // Une famille réglée à part (part, évolution) : le détail le signale
        const aPart = l.some((f) => ['mix', 'evolution'].some((t) => lireCible(cibles, `${t}/${cleFamille(f)}`) !== undefined))
        const ouvert = !!ouverts[u]
        return (
          <Box key={u} component="section" aria-label={nomU} sx={{ px: 2.5, py: 2.5 }}>
            {i > 0 && <Divider sx={{ mx: -2.5, mt: -2.5, mb: 2.5 }} />}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 2, rowGap: 0.5, mb: 2 }}>
              <Typography variant="h3" sx={{ fontSize: '1.125rem' }}>{nomU}</Typography>
              <Typography sx={{ fontSize: '0.9375rem' }}>
                <Box component="span" sx={{ color: 'text.secondary' }}>{milliers(n)} → </Box>
                <Box component="span" sx={{ fontWeight: 700 }}>{milliers(b)}</Box>
                <Box component="span" sx={{ color: !n || Math.round(b) === Math.round(n) ? 'text.secondary' : b > n ? 'success.dark' : 'error.dark', fontWeight: 600 }}>{n ? ` (${b >= n ? '+' : ''}${taux(b / n - 1)})` : ''}</Box>
              </Typography>
              <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary' }}>Marge {annee} : {milliers(m)}{b ? ` · ${taux(m / b)}` : ''}</Typography>
            </Box>
            <Box sx={grille}>
              {fl ? (
                <>
                  {parCle(`flux/${u}`, `Tickets (${nomU})`, `Évolution du nombre de tickets : ${nomU}`, `évolution des tickets ${nomU}`, 'tickets',
                    `${enChiffres(Math.round(fl.atterrissage))} → ${enChiffres(Math.round(fl.objectif))}`)}
                  {parCle(`panier/${u}`, `Panier moyen TTC (${nomU})`, `Évolution du panier moyen : ${nomU}`, `évolution du panier ${nomU}`, 'panier',
                    `${panier(fl.panierRealiseTTC)} → ${panier(fl.panierObjectifTTC)}`)}
                </>
              ) : parCle(`univers/${u}`, `Évolution du CA (${nomU})`, `Évolution du CA par univers : ${nomU}`, `évolution du CA ${nomU}`, 'univers')}
              {parUnivers(u, 'marge', nomU)}
              {parUnivers(u, 'demarque', nomU)}
            </Box>
            <Button onClick={() => setOuverts({ ...ouverts, [u]: !ouvert })} aria-expanded={ouvert} className="pas-a-l-impression"
              endIcon={ouvert ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ mt: 1.5, ml: -1, minHeight: 48 }}>
              Détail par famille ({l.length})
              {aPart && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: 'warning.dark' }}>réglé famille par famille</Box>}
            </Button>
            {ouvert && (
              <TableContainer sx={{ mx: -2.5, width: 'auto' }}>
                <GrilleHypotheses detail titre={`Familles : ${nomU}`} familles={l} flux={flux} annee={annee}
                  cibles={cibles} auDessus={auDessus} valeursBase={valeursBase} onChange={onChange} lectureSeule={lectureSeule} />
              </TableContainer>
            )}
          </Box>
        )
      })}
      <Box component="section" aria-label="Salaires et frais" sx={{ px: 2.5, py: 2.5 }}>
        <Divider sx={{ mx: -2.5, mt: -2.5, mb: 2.5 }} />
        <Typography variant="h3" sx={{ fontSize: '1.125rem', mb: 2 }}>Salaires et frais</Typography>
        <Box sx={grille}>
          {parCle('hausseSalaires', 'Hausse des salaires', 'Salaires et frais : Hausse des salaires', 'Hausse des salaires', 'hausseSalaires')}
          {parCle('inflationFrais', 'Inflation des frais', 'Salaires et frais : Inflation des frais', 'Inflation des frais', 'inflationFrais')}
        </Box>
      </Box>
    </Box>
  )
}

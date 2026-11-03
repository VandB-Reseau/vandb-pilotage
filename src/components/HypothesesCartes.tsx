import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import { lienMagasin, milliers, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import type { Budget, Hypotheses } from '../moteur/types'
import type { ThemeAccord } from '../moteur/changements'

// Lot 37 (Joseph, 02/11/2026, option H2) : une carte par thème ; un clic ouvre le détail du thème.
// Lot 42 : les ventes et le résultat sont sur la page « Construire » ; restent ici les thèmes en détail, chacun avec son
// « D'accord » pour le franchisé. L'équipe et les frais repris des comptes, la trésorerie estimée sont dits comme tels.
type Ligne = { libelle: string; valeur: ReactNode; signal?: boolean }

function Carte({ titre, vers, lignes, action, magasin, accord }: { titre: string; vers: string; lignes: Ligne[]; action: string; magasin: string; accord?: ReactNode }) {
  return (
    <Card component="section" aria-label={titre} sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={RouterLink} to={lienMagasin(magasin, vers)} data-sans-garde=""
        sx={{ p: 2.5, pb: accord ? 1 : 2.5, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 1 }}>
        <Typography variant="h3" sx={{ fontSize: '1.125rem' }}>{titre}</Typography>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 2, rowGap: 0.75, flex: 1 }}>
          {lignes.map((l) => (
            <Box key={l.libelle} sx={{ display: 'contents' }}>
              <Box component="dt" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{l.libelle}</Box>
              <Box component="dd" sx={{ m: 0, textAlign: 'right', fontWeight: 600, fontSize: '0.875rem', color: l.signal ? 'warning.dark' : 'text.primary' }}>{l.valeur}</Box>
            </Box>
          ))}
        </Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', color: 'primary.main', fontWeight: 700, fontSize: '0.875rem', mt: 0.5 }}>
          {action}<ChevronRightOutlined fontSize="small" />
        </Box>
      </CardActionArea>
      {accord && <Box sx={{ px: 2.5, pb: 2 }}>{accord}</Box>}
    </Card>
  )
}

const nombre = (n: number, un: string, plusieurs: string) => (n === 0 ? 'Aucun' : `${n} ${n > 1 ? plusieurs : un}`)

export function HypothesesCartes({ magasin, annee, budget: b, cibles, hausseSalaires, inflation, sansEquipe, lectureSeule, reprise, accord }: {
  magasin: string
  annee: number
  budget: Budget
  cibles: Cibles
  hausseSalaires: number
  inflation: number
  sansEquipe: boolean
  lectureSeule: boolean
  reprise?: Hypotheses['reprise']
  accord?: (theme: ThemeAccord, nom: string) => ReactNode
}) {
  const action = lectureSeule ? 'Voir le détail' : 'Détailler'
  const travaux = cibles.travaux ? cibles.travaux.activite.filter((a) => a < 1).length : 0
  const frais = b.chargesExternes + b.impotsTaxes - b.redevance - b.publicite
  const lignesFrais = Object.keys(cibles.fraisBudget ?? {}).length
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      <Carte magasin={magasin} titre="Calendrier" vers="calendrier" action={action} accord={accord?.('calendrier', 'Calendrier')} lignes={[
        { libelle: 'Saisonnalité', valeur: cibles.poidsMois ? 'Propre au magasin' : 'Celle du magasin ou du réseau' },
        { libelle: 'Travaux, fermeture', valeur: travaux ? `${travaux} mois touché${travaux > 1 ? 's' : ''}` : 'Aucun' },
        { libelle: 'Temps forts', valeur: nombre(cibles.tempsForts?.length ?? 0, 'temps fort', 'temps forts') },
        { libelle: 'Clients gagnés ou perdus', valeur: nombre(cibles.ajustementsCA?.length ?? 0, 'changement', 'changements') },
      ]} />
      <Carte magasin={magasin} titre="Équipe" vers="equipe" action={sansEquipe && !reprise?.personnel && !lectureSeule ? 'Renseigner l’équipe' : action} accord={accord?.('equipe', 'Équipe')} lignes={[
        ...(reprise?.personnel ? [{ libelle: 'Équipe', valeur: `Comptes ${reprise.annee} (${reprise.mois} mois)` }]
          : sansEquipe ? [{ libelle: 'Équipe', valeur: 'à renseigner', signal: true }] : []),
        { libelle: 'Hausse générale des salaires', valeur: taux(hausseSalaires) },
        { libelle: 'Masse salariale', valeur: milliers(b.personnel) },
        { libelle: '% FP', valeur: taux(b.ratios.pctFP) },
      ]} />
      <Carte magasin={magasin} titre="Frais" vers="fraisBudget" action={action} accord={accord?.('fraisBudget', 'Frais')} lignes={[
        ...(reprise?.frais ? [{ libelle: 'Frais de départ', valeur: `Comptes ${reprise.annee} (${reprise.mois} mois)` }] : []),
        { libelle: 'Inflation des frais', valeur: taux(inflation) },
        { libelle: 'Lignes choisies une à une', valeur: lignesFrais === 0 ? 'Aucune' : String(lignesFrais) },
        { libelle: `Frais ${annee}`, valeur: milliers(frais) },
      ]} />
      {/* Lot 43 : la trésorerie au 1er janvier se règle au point de départ, le plan se lit sous le résultat */}
    </Box>
  )
}

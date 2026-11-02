import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import { lienMagasin, milliers, MOIS_LONGS, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import { UNIVERS, universLibelle, type Budget } from '../moteur/types'
import type { Tresorerie } from '../moteur/tresorerie'

// Lot 37 (Joseph, 02/11/2026, option H2) : toutes les hypothèses du budget sur une page, une carte par thème. Un clic sur
// une carte ouvre le tableau court du thème ; la carte Résultat mène à l'étape suivante.
type Ligne = { libelle: string; valeur: ReactNode; signal?: boolean }

function Carte({ titre, vers, lignes, action, magasin }: { titre: string; vers: string; lignes: Ligne[]; action: string; magasin: string }) {
  return (
    <Card component="section" aria-label={titre} sx={{ display: 'flex' }}>
      <CardActionArea component={RouterLink} to={lienMagasin(magasin, vers)} data-sans-garde=""
        sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 1 }}>
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
    </Card>
  )
}

const nombre = (n: number, un: string, plusieurs: string) => (n === 0 ? 'Aucun' : `${n} ${n > 1 ? plusieurs : un}`)

export function HypothesesCartes({ magasin, annee, budget: b, cibles, hausseSalaires, inflation, sansEquipe, tresorerie, lectureSeule }: {
  magasin: string
  annee: number
  budget: Budget
  cibles: Cibles
  hausseSalaires: number
  inflation: number
  sansEquipe: boolean
  tresorerie: Tresorerie | null
  lectureSeule: boolean
}) {
  const action = lectureSeule ? 'Voir le détail' : 'Modifier'
  const somme = (l: number[]) => l.reduce((a, x) => a + x, 0)
  const ventes: Ligne[] = UNIVERS.filter((u) => b.familles.some((f) => f.univers === u)).map((u) => {
    const l = b.familles.filter((f) => f.univers === u)
    const n = somme(l.map((f) => f.atterrissage)), o = somme(l.map((f) => f.objectif))
    return { libelle: universLibelle[u], valeur: `${milliers(o)}${n ? ` (${o >= n ? '+' : ''}${taux(o / n - 1)})` : ''}` }
  })
  ventes.push({ libelle: 'Marge commerciale', valeur: taux(b.tauxMarge) })
  const travaux = cibles.travaux ? cibles.travaux.activite.filter((a) => a < 1).length : 0
  const frais = b.chargesExternes + b.impotsTaxes - b.redevance - b.publicite
  const lignesFrais = Object.keys(cibles.fraisBudget ?? {}).length
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      <Carte magasin={magasin} titre="Ventes" vers="ventes" action={action} lignes={ventes} />
      <Carte magasin={magasin} titre="Calendrier" vers="calendrier" action={action} lignes={[
        { libelle: 'Saisonnalité', valeur: cibles.poidsMois ? 'Propre au magasin' : 'Celle du magasin ou du réseau' },
        { libelle: 'Travaux, fermeture', valeur: travaux ? `${travaux} mois touché${travaux > 1 ? 's' : ''}` : 'Aucun' },
        { libelle: 'Temps forts', valeur: nombre(cibles.tempsForts?.length ?? 0, 'temps fort', 'temps forts') },
        { libelle: 'Clients gagnés ou perdus', valeur: nombre(cibles.ajustementsCA?.length ?? 0, 'changement', 'changements') },
      ]} />
      <Carte magasin={magasin} titre="Équipe" vers="equipe" action={sansEquipe && !lectureSeule ? 'Renseigner l’équipe' : action} lignes={[
        ...(sansEquipe ? [{ libelle: 'Équipe', valeur: 'à renseigner', signal: true }] : []),
        { libelle: 'Hausse générale des salaires', valeur: taux(hausseSalaires) },
        { libelle: 'Masse salariale', valeur: milliers(b.personnel) },
        { libelle: '% FP', valeur: taux(b.ratios.pctFP) },
      ]} />
      <Carte magasin={magasin} titre="Frais" vers="fraisBudget" action={action} lignes={[
        { libelle: 'Inflation des frais', valeur: taux(inflation) },
        { libelle: 'Lignes choisies une à une', valeur: lignesFrais === 0 ? 'Aucune' : String(lignesFrais) },
        { libelle: `Frais ${annee}`, valeur: milliers(frais) },
      ]} />
      <Carte magasin={magasin} titre="Trésorerie" vers="tresoBudget" action={action} lignes={[
        { libelle: 'Au 1er janvier', valeur: cibles.tresorerieDepart === undefined ? 'à saisir' : milliers(cibles.tresorerieDepart), signal: cibles.tresorerieDepart === undefined },
        ...(tresorerie ? [
          { libelle: 'Fin décembre', valeur: milliers(tresorerie.fin) },
          { libelle: 'Point bas', valeur: `${milliers(tresorerie.pointBas.montant)} (${MOIS_LONGS[tresorerie.pointBas.mois]})`, signal: tresorerie.pointBas.montant < 0 },
        ] : []),
      ]} />
      <Carte magasin={magasin} titre="Résultat" vers="resultat" action="Voir le résultat" lignes={[
        { libelle: 'Chiffre d’affaires HT', valeur: milliers(b.ca) },
        { libelle: 'EBE', valeur: `${milliers(b.ebe)} (${taux(b.ratios.ebeSurCA)})` },
        { libelle: 'Résultat net', valeur: milliers(b.resultatNet) },
      ]} />
    </Box>
  )
}

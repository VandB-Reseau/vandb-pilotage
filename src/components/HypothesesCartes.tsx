import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import { BoutonCommenter } from './Commentaires'
import { ecartMilliers, ecartTaux, lienMagasin, milliers, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import { universLibelle, type Budget, type Hypotheses } from '../moteur/types'
import type { ThemeAccord } from '../moteur/changements'
import { etatCalendrier, etatEquipe, etatFrais, etatInvestissements, QUESTIONS_CALENDRIER, QUESTIONS_INVESTISSEMENTS, reponseQuestion, resumeUnivers, saisiesQuestion, type EtatCarte, type QuestionCalendrier } from '../moteur/questions'

// Lot 37 (Joseph, 02/11/2026, option H2) : une carte par thème ; un clic ouvre le détail du thème.
// Joseph (03/11/2026) : les ventes de chaque univers en cartes, comme le Calendrier, l'Équipe et les Frais, pour voir d'un
// coup d'œil tout ce qui se règle ; chaque carte dit ce qu'il reste à faire (« À faire », « À vérifier », « Fait ») et
// son bouton suit (« Remplir », « Vérifier », « Modifier »).
type Ligne = { libelle: string; valeur: ReactNode; signal?: boolean }

const ETATS: Record<EtatCarte, { texte: string; couleur: 'warning' | 'info' | 'success'; action: string }> = {
  aFaire: { texte: 'À faire', couleur: 'warning', action: 'Remplir' },
  aVerifier: { texte: 'À vérifier', couleur: 'info', action: 'Vérifier' },
  fait: { texte: 'Fait', couleur: 'success', action: 'Modifier' },
}

function Carte({ titre, sousTitre, vers, ancre, lignes, etat, lectureSeule, magasin, accord }: {
  titre: string; sousTitre?: ReactNode; vers: string; ancre?: string; lignes: Ligne[]; etat?: EtatCarte; lectureSeule: boolean; magasin: string; accord?: ReactNode
}) {
  const action = lectureSeule ? 'Voir le détail' : etat ? ETATS[etat].action : 'Modifier'
  return (
    <Card component="section" aria-label={titre} sx={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <CardActionArea component={RouterLink} to={lienMagasin(magasin, vers)} data-sans-garde="" aria-label={`${titre} : ${action.toLowerCase()}${etat ? ` (${ETATS[etat].texte.toLowerCase()})` : ''}`}
        sx={{ p: 2.5, pb: accord ? 1 : 2.5, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pr: { xs: 5, lg: 4 } }}>
          <Typography variant="h3" component="h3" sx={{ flex: 1 }}>{titre}</Typography>
          {etat && <Chip size="small" color={ETATS[etat].couleur} label={ETATS[etat].texte} />}
        </Box>
        {sousTitre && <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{sousTitre}</Typography>}
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
      {/* Le commentaire se pose sur la carte, hors du lien qui ouvre le thème : même point que la page du thème */}
      <Box sx={{ position: 'absolute', top: { xs: 8, lg: 14 }, right: { xs: 6, lg: 10 } }}>
        <BoutonCommenter ancre={ancre ?? `theme/${vers}`} libelle={titre} />
      </Box>
      {accord && <Box sx={{ px: 2.5, pb: 2 }}>{accord}</Box>}
    </Card>
  )
}

const nombre = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`
const LIBELLES_QUESTIONS: Record<QuestionCalendrier, { libelle: string; un: string; plusieurs: string }> = {
  travaux: { libelle: 'Travaux, fermeture', un: 'chantier', plusieurs: 'chantiers' },
  investissements: { libelle: 'Achats d’équipement', un: 'achat', plusieurs: 'achats' },
  emprunts: { libelle: 'Emprunt ou apport', un: 'financement', plusieurs: 'financements' },
  tempsForts: { libelle: 'Temps forts', un: 'temps fort', plusieurs: 'temps forts' },
  ajustementsCA: { libelle: 'Clients extérieurs', un: 'client', plusieurs: 'clients' },
}

// Point de départ (Joseph, 03/11/2026 : une carte de « Construire ») : CA atterri de l'année en cours, trésorerie au
// 1er janvier (saisie ou estimée), saisonnalité du magasin ou de l'an passé
export interface ResumeDepart { annee: number; tresorerie: number | null; estimee: boolean; saisonnalite: boolean }

export function HypothesesCartes({ magasin, annee, budget: b, cibles, hausseSalaires, inflation, sansEquipe, sansFrais, lectureSeule, reprise, accord, depart }: {
  magasin: string
  annee: number
  budget: Budget
  cibles: Cibles
  hausseSalaires: number
  inflation: number
  sansEquipe: boolean
  sansFrais: boolean
  lectureSeule: boolean
  reprise?: Hypotheses['reprise']
  accord?: (theme: ThemeAccord, nom: string) => ReactNode
  depart: ResumeDepart
}) {
  const frais = b.chargesExternes + b.impotsTaxes - b.redevance - b.publicite
  const lignesFrais = Object.keys(cibles.fraisBudget ?? {}).length
  const question = (q: QuestionCalendrier): Ligne => {
    const r = reponseQuestion(cibles, q), t = LIBELLES_QUESTIONS[q]
    return { libelle: t.libelle, valeur: r === 'saisie' ? nombre(saisiesQuestion(cibles, q), t.un, t.plusieurs) : r === 'rien' ? 'Rien de prévu' : 'À répondre', signal: r === 'aRepondre' }
  }
  const f = b.financement
  const ecartEvenements = (b.tempsForts?.ajoute ?? 0) - (b.tempsForts?.retire ?? 0) + (b.tempsForts?.ajustements ?? 0)
  return (
    <Box component="section" aria-label={`Hypothèses ${annee} en cartes`}
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      <Carte magasin={magasin} titre="Point de départ" vers="depart" etat={depart.tresorerie === null || depart.estimee ? 'aVerifier' : 'fait'} lectureSeule={lectureSeule}
        accord={accord?.('tresoBudget', 'Point de départ')} lignes={[
          { libelle: `CA atterri ${depart.annee}`, valeur: milliers(b.atterrissage) },
          { libelle: 'Trésorerie au 1er janvier', valeur: depart.tresorerie === null ? 'À saisir' : `${milliers(depart.tresorerie)}${depart.estimee ? ' (estimée)' : ''}`, signal: depart.tresorerie === null || depart.estimee },
          { libelle: 'Saisonnalité', valeur: depart.saisonnalite ? 'Propre au magasin' : `Celle de ${depart.annee}` },
        ]} />
      {resumeUnivers(b).map((r) => (
        <Carte key={r.univers} magasin={magasin} titre={`Ventes ${universLibelle[r.univers]}`} vers="ventes" ancre={`ventes/${r.univers}`} lectureSeule={lectureSeule}
          sousTitre={<><Box component="span" sx={{ color: 'text.secondary' }}>{milliers(r.depart)} → </Box><b>{milliers(r.ca)}</b>{r.ecart !== null && <Box component="span" sx={{ color: 'text.secondary' }}>{` (${ecartTaux(r.ecart)})`}</Box>}</>}
          lignes={[
            ...(r.tickets !== undefined ? [{ libelle: 'Tickets', valeur: ecartTaux(r.tickets) }, { libelle: 'Panier moyen', valeur: ecartTaux(r.panier ?? 0) }]
              : [{ libelle: 'Évolution du CA', valeur: ecartTaux(r.evolution ?? 0) }]),
            { libelle: 'Marge visée', valeur: r.marge === null ? '–' : taux(r.marge) },
          ]} />
      ))}
      <Carte magasin={magasin} titre="Évènements & Temps forts" vers="calendrier" etat={etatCalendrier(cibles)} lectureSeule={lectureSeule} accord={accord?.('calendrier', 'Évènements & Temps forts')}
        lignes={[...QUESTIONS_CALENDRIER.map(question), ...(ecartEvenements ? [{ libelle: `Écart face à ${depart.annee}`, valeur: ecartMilliers(ecartEvenements) }] : [])]} />
      <Carte magasin={magasin} titre="Investissements & Financements" vers="investissements" etat={etatInvestissements(cibles)} lectureSeule={lectureSeule} accord={accord?.('investissements', 'Investissements & Financements')}
        lignes={[
          ...QUESTIONS_INVESTISSEMENTS.map(question),
          { libelle: 'Capacité d’autofinancement', valeur: milliers(b.capaciteAutofinancement) },
          ...(f.echeancesSurCAF !== null && f.echeances > 0 ? [{ libelle: 'Échéances ÷ CAF', valeur: taux(f.echeancesSurCAF) }] : []),
        ]} />
      <Carte magasin={magasin} titre="Équipe" vers="equipe" etat={etatEquipe(sansEquipe, !!reprise?.personnel)} lectureSeule={lectureSeule} accord={accord?.('equipe', 'Équipe')} lignes={[
        ...(reprise?.personnel ? [{ libelle: 'Équipe', valeur: `Comptes ${reprise.annee} (${reprise.mois} mois)` }]
          : sansEquipe ? [{ libelle: 'Équipe', valeur: 'À renseigner', signal: true }] : []),
        { libelle: 'Hausse générale des salaires', valeur: taux(hausseSalaires) },
        { libelle: 'Masse salariale', valeur: milliers(b.personnel) },
        { libelle: '% FP', valeur: taux(b.ratios.pctFP) },
      ]} />
      <Carte magasin={magasin} titre="Frais" vers="fraisBudget" etat={etatFrais(sansFrais, !!reprise?.frais)} lectureSeule={lectureSeule} accord={accord?.('fraisBudget', 'Frais')} lignes={[
        ...(reprise?.frais ? [{ libelle: 'Frais de départ', valeur: `Comptes ${reprise.annee} (${reprise.mois} mois)` }] : []),
        { libelle: 'Inflation des frais', valeur: taux(inflation) },
        { libelle: 'Lignes choisies une à une', valeur: lignesFrais === 0 ? 'Aucune' : String(lignesFrais) },
        { libelle: `Frais ${annee}`, valeur: milliers(frais) },
      ]} />
    </Box>
  )
}

import { useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { CompteResultatMois } from './CompteResultatMois'
import { EtatVide } from './EtatVide'
import { Panne } from './Panne'
import { avecEquipeEtFrais, chargerReel, chargerSecours, niveauxDe, proposerBudget, type DonneesBudgets, type LigneMagasin } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, MOIS_LONGS, taux } from '../lib/format'
import { compteResultat } from '../moteur/compteResultat'
import { baseDepuisReel } from '../moteur/atterrissage'
import { reglesDe } from '../moteur/regles'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles } from '../moteur/cibles'
import type { ParametresReseau } from '../moteur/types'
import Card from '@mui/material/Card'
import { DetailCalcul } from './DetailCalcul'
import { Indicateur } from './Indicateur'
import { FichePrete } from './FichePrete'
import { ebeComplet } from '../moteur/preparation'
import { syntheseReel } from '../moteur/reel'
import { reelEnRetard } from '../lib/aFaire'
import { tresorerieDepartEstimee } from '../moteur/reprise'
import { TresorerieDepart } from './TresorerieDepart'
import { Aide } from './Aide'

// Atterrissage de l'année en cours : réel des mois passés, projection des mois restants, équipe et frais du magasin.
// Le Directeur en tire la proposition du budget de l'an prochain.
// Joseph (03/11/2026) : la carte « Saisonnalité » (part de l'année réalisée par univers) est retirée ; le calcul reste
// automatique, et une part déjà enregistrée reste prise en compte.

export function AtterrissageMagasin({ ligne, d, annee, anneeBudget, parametres, directeur, allerA, apresProposition, tresorerieDepart, saisonnaliteBudget, baseCA, repartition }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  anneeBudget: number
  parametres: ParametresReseau
  directeur: boolean
  peutSaisir: boolean
  allerA: (onglet: string) => void
  apresProposition: () => void
  tresorerieDepart?: ReactNode   // lot 43 : budget proposé, la trésorerie au 1er janvier se règle ici
  // Joseph (03/11/2026) : la saisonnalité sort du Calendrier et remplace la Projection des mois restants ; elle finit
  // l'année en cours et répartit le budget. La base du CA vient avec, au point de départ.
  saisonnaliteBudget?: ReactNode
  baseCA?: ReactNode
  // Joseph (03/11/2026) : répartition par mois saisie pour le magasin ; les mois restants de l'année la suivent
  repartition?: number[]
}) {
  const magasin = ligne.magasin
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee)]).then(([n, n1, secours]) => ({ n, n1, secours })), [magasin, annee])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={240} />
  if (erreur || !donnees) return <Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />

  const regles = reglesDe(parametres)
  const r = baseDepuisReel(donnees, annee, [], undefined, { ...donnees.secours, repartition }, regles)
  if (!r) {
    return (
      <Stack spacing={3}>
        <EtatVide
          titre={`Pas encore de réel ${annee}`}
          texte={`L’atterrissage ${annee} part des chiffres réels des mois passés.`}
          action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
        />
        {tresorerieDepart ?? <TresorerieDepart annee={anneeBudget} depart={undefined} estimee={null} lectureSeule />}
        {/* Sans réel de l'année, la saisonnalité du budget se règle quand même ici */}
        {saisonnaliteBudget && (
          <Card component="section" aria-label="Saisonnalité" sx={{ pb: 1 }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Saisonnalité</Typography><Aide sujet="saisonnalite" /></Box>
            {saisonnaliteBudget}
          </Card>
        )}
        {baseCA}
      </Stack>
    )
  }

  const equipe = d.equipes[magasin]
  const frais = d.frais[magasin]
  const comptes = d.comptes?.[magasin]
  const prets = d.prets?.[magasin]
  const h = avecEquipeEtFrais(r.base, equipe, frais, comptes, prets)
  const b = calculerBudget(h, parametres)
  const peutProposer = directeur && ligne.statut !== 'valide'
  // Lot 41 (proposition 2) : ce qui manque pour proposer un budget juste ; sans équipe ni frais, l'EBE est incomplet
  const etatFiche = {
    reel: !reelEnRetard(syntheseReel(donnees.n.lignes, donnees.n.tickets).moisRenseignes), ouverture: !!(donnees.secours.ouverture ?? d.ouvertures?.[magasin]),
    // Lot 42 : la masse salariale et les frais repris des comptes de l'année valent équipe et frais
    equipe: !!equipe?.length || !!h.reprise?.personnel, frais: !!frais?.length || !!h.reprise?.frais,
  }
  const complet = ebeComplet(etatFiche)
  const manque = [!etatFiche.equipe && 'équipe', !etatFiche.frais && 'frais'].filter(Boolean).join(' ni ')

  const proposer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      const base = { ...avecEquipeEtFrais(r.base, undefined, frais), annee: anneeBudget }
      const { hypotheses } = appliquerCibles(avecEquipeEtFrais(base, equipe, frais, comptes, prets), niveauxDe(ligne, d))
      await proposerBudget(magasin, anneeBudget, base, hypotheses)
      setMessage({ gravite: 'success', texte: `Budget ${anneeBudget} proposé à partir de l’atterrissage ${annee}.` })
      apresProposition()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <Stack spacing={3}>
      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>}

      {ligne.statut !== 'valide' && (
        <FichePrete magasin={magasin} etat={etatFiche} reprise={h.reprise} allerA={allerA} directeur={directeur} apresOuverture={() => { recharger(); apresProposition() }} />
      )}

      {peutProposer && (
        <Box>
          <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe} onClick={() => void proposer()} sx={{ minHeight: 48 }}>
            {ligne.base ? `Mettre à jour la proposition ${anneeBudget}` : `Proposer le budget ${anneeBudget}`}
          </Button>
        </Box>
      )}

      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Atterrissage ${annee} en chiffres`}>
        <Indicateur libelle={`CA HT atterri ${annee}`} valeur={milliers(b.ca)} detail={`Dont réalisé : ${milliers(r.realise)}`}
          info={<DetailCalcul quoi="atterrissage" budget={b} annee={annee} atterrissage={r} />} />
        <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} info={<DetailCalcul quoi="marge" budget={b} annee={annee} />} />
        <Indicateur libelle="EBE" valeur={complet ? milliers(b.ebe) : 'Incomplet'} detail={complet ? `${taux(b.ratios.ebeSurCA)} du CA` : `Sans ${manque} : ${milliers(b.ebe)} calculés`} info={<DetailCalcul quoi="ebe" budget={b} annee={annee} />} />
      </Stack>

      {/* Lot 43 (Joseph, 03/11/2026) : la trésorerie au 1er janvier, à côté de l'atterrissage ; estimée tant que le budget n'est pas proposé */}
      {tresorerieDepart ?? <TresorerieDepart annee={anneeBudget} depart={undefined} estimee={tresorerieDepartEstimee(h, comptes, parametres)} lectureSeule />}

      <CompteResultatMois
        lignes={compteResultat(b, h, parametres)} projeteA={r.moisRealises} moisEnCours={annee === new Date().getFullYear() ? new Date().getMonth() : null}
        titre={`Compte de résultat ${annee}`} libelleTableau={`Atterrissage ${annee} mois par mois`}
        entete={
          <Typography variant="body2" color="text.secondary">
            {repartition
              ? `Réel jusqu’à ${MOIS_LONGS[r.moisRealises - 1]}, mois restants répartis selon la saisonnalité du magasin (carte Point de départ du budget)`
              : `Réel jusqu’à ${MOIS_LONGS[r.moisRealises - 1]}, mois restants projetés par univers selon la saisonnalité (détail dans le (i) du CA atterri)`}
          </Typography>
        }
      />


      {baseCA}
    </Stack>
  )
}

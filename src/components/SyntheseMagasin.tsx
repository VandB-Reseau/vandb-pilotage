import { useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import FlagOutlined from '@mui/icons-material/FlagOutlined'
import { ObjectifsMois } from './ObjectifsMois'
import { EtatVide } from './EtatVide'
import { FicheVisite } from './FicheVisite'
import { LeviersCommerciaux } from './LeviersCommerciaux'
import { GraphiqueMois } from './GraphiqueMois'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { PlusLoin } from './PlusLoin'
import { atterrissageDe, chargerBudgets, chargerReel, chargerSecours, hypothesesDe, type DonneesBudgets } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartPts, milliers, montant, MOIS_LONGS, taux } from '../lib/format'
import { usePreference } from '../lib/preferences'
import { calculerBudget } from '../moteur/budget'
import { cumul, cumulApres, santeMagasin } from '../moteur/sante'
import { moisDuReel, suiviBudget } from '../moteur/suivi'
import type { ParametresReseau } from '../moteur/types'
import { brand } from '../theme/theme'

// Santé du magasin en un coup d'œil : cumul de l'année face au budget de l'année (lot 27) et à l'an dernier, marge,
// masse salariale, résultat attendu ; CA cumulé ou mois par mois. Lot 30 (E2) : trois blocs, où on en est (les chiffres),
// quoi faire (À faire, alertes, plan d'action) et, replié, pour aller plus loin (graphique, leviers, face au réseau)
export function SyntheseMagasin({ magasin, d, annee, parametres, allerA, visiteEtActions, proposerAction, quoiFaire, plusLoin }: {
  magasin: string
  d: DonneesBudgets
  annee: number
  parametres: ParametresReseau
  allerA: (onglet: string) => void
  visiteEtActions?: boolean                     // Directeur, RR, Coach : fiche de visite (lot 28)
  proposerAction?: (intitule: string) => void   // leviers commerciaux → plan d'action (lot 28)
  quoiFaire?: ReactNode
  plusLoin?: ReactNode                          // face au réseau, familles : seulement pour le siège
}) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee), chargerBudgets(annee).catch(() => null)])
      .then(([n, n1, secours, budgets]) => ({ n, n1, secours, budgets })), [magasin, annee])
  const [vue, setVue] = usePreference<'cumul' | 'mois'>('synthese', 'cumul', ['cumul', 'mois'])
  const [visite, setVisite] = useState(false)
  const [objectifs, setObjectifs] = useState(false)

  const contenu = plusLoin ? '(graphique, leviers, face au réseau)' : '(graphique, leviers)'
  if (chargement && !donnees) return <Stack spacing={3}><Skeleton variant="rounded" height={320} />{quoiFaire}</Stack>
  if (erreur || !donnees) return <Stack spacing={3}><Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />{quoiFaire}</Stack>

  const equipe = d.equipes[magasin]
  const frais = d.frais[magasin]
  const a = atterrissageDe(donnees, annee, equipe, frais, parametres, donnees.secours)
  const s = santeMagasin(donnees.n, donnees.n1, a?.budget ?? null)
  if (s.moisRealises === 0 || !a) {
    return (
      <Stack spacing={3}>
        <EtatVide
          titre={`Pas encore de réel ${annee}`}
          texte={`La synthèse du magasin part des chiffres réels ${annee}, importés chaque mois ou saisis à la main.`}
          action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
        />
        {quoiFaire}
        {plusLoin && <PlusLoin contenu="(face au réseau)">{plusLoin}</PlusLoin>}
      </Stack>
    )
  }
  const b = a.budget
  const finMois = MOIS_LONGS[s.moisRealises - 1]
  // Budget de l'année en cours, s'il a été proposé : le réel à date lui est comparé, mois par mois
  const ligneN = donnees.budgets?.magasins.find((l) => l.magasin === magasin)
  const hN = ligneN?.statut && donnees.budgets ? hypothesesDe(ligneN, donnees.budgets) : null
  const budgetN = hN ? calculerBudget(hN.hypotheses, parametres) : null
  const suivi = budgetN ? suiviBudget(moisDuReel(donnees.n.lignes, donnees.n.tickets), budgetN) : null
  const ecartCA = suivi?.cumul.ecartCAPart ?? null
  const ecartMarge = suivi && s.tauxMarge !== null ? s.tauxMarge - suivi.cumul.tauxMargeBudget : null
  const evolution = s.evolution === null ? null : `${s.evolution >= 0 ? '+' : '−'}${taux(Math.abs(s.evolution))} sur ${annee - 1}`
  const manques = [
    !equipe?.length && { onglet: 'equipe', texte: 'Équipe non renseignée : la masse salariale compte pour zéro.', action: 'Renseigner l’équipe' },
    !frais?.length && { onglet: 'frais', texte: 'Frais non renseignés : seules la redevance et la publicité sont comptées.', action: 'Renseigner les frais' },
  ].filter((x): x is { onglet: string; texte: string; action: string } => !!x)

  const n = moisDuReel(donnees.n.lignes, donnees.n.tickets)
  return (
    <Stack spacing={3}>
      {(visiteEtActions || budgetN) && (
        <Box className="pas-a-l-impression" sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, flexWrap: 'wrap', mb: -1 }}>
          {budgetN && <Button variant="outlined" startIcon={<FlagOutlined />} onClick={() => setObjectifs(true)} sx={{ minHeight: 48 }}>Objectifs du mois</Button>}
          {visiteEtActions && <Button variant="outlined" startIcon={<FactCheckOutlined />} onClick={() => setVisite(true)} sx={{ minHeight: 48 }}>Fiche de visite</Button>}
          {visite && (
            <FicheVisite ouverte fermer={() => setVisite(false)} magasin={magasin} annee={annee} n={n}
              n1={moisDuReel(donnees.n1.lignes, donnees.n1.tickets)} budget={budgetN} tvaPanier={parametres.tvaPanier} />
          )}
          {objectifs && budgetN && (
            <ObjectifsMois ouverte fermer={() => setObjectifs(false)} magasin={magasin} annee={annee} budget={budgetN}
              n1={moisDuReel(donnees.n1.lignes, donnees.n1.tickets)} tvaPanier={parametres.tvaPanier} />
          )}
        </Box>
      )}
      <Box component="section" aria-label={`Santé du magasin à fin ${finMois}`} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Indicateur
          libelle={`CA HT à fin ${finMois}`} valeur={milliers(s.caCumule)} serie={s.serieN}
          ecart={ecartCA !== null ? { texte: `${taux(Math.abs(ecartCA))} face au budget`, hausse: ecartCA >= 0, favorable: ecartCA >= 0 }
            : s.evolution === null ? undefined : { texte: `${taux(Math.abs(s.evolution))} sur ${annee - 1}`, hausse: s.evolution >= 0, favorable: s.evolution >= 0 }}
          detail={[suivi && `Budget à date : ${milliers(suivi.cumul.caBudget)}`, suivi && evolution, `Atterrissage ${annee} : ${milliers(b.ca)}`].filter(Boolean).join(' · ')}
        />
        <Indicateur
          libelle="Marge commerciale" valeur={s.tauxMarge === null ? 'Non connue' : taux(s.tauxMarge)}
          ecart={ecartMarge === null ? undefined : { texte: `${ecartPts(Math.abs(ecartMarge)).replace('+', '')} face au budget`, hausse: ecartMarge >= 0, favorable: ecartMarge >= 0 }}
          detail={s.tauxMarge === null ? 'Marge absente des chiffres de caisse'
            : suivi ? `Budget : ${taux(suivi.cumul.tauxMargeBudget)} · ${milliers(s.margeCumulee)} à fin ${finMois}` : `${milliers(s.margeCumulee)} à fin ${finMois}`}
        />
        <Indicateur
          libelle="Masse salariale / marge" valeur={equipe?.length ? taux(b.ratios.personnelSurMarge) : 'À renseigner'}
          detail={equipe?.length ? `${milliers(b.personnel)} sur l’année` : 'Équipe non renseignée'}
        />
        <Indicateur
          libelle={`EBE attendu ${annee}`} valeur={milliers(b.ebe)} serie={b.mois.map((m) => m.ebe)}
          ecart={budgetN ? { texte: `${milliers(Math.abs(b.ebe - budgetN.ebe))} face au budget`, hausse: b.ebe >= budgetN.ebe, favorable: b.ebe >= budgetN.ebe } : undefined}
          detail={budgetN ? `Budget : ${milliers(budgetN.ebe)} · ${taux(b.ratios.ebeSurCA)} du CA` : `${taux(b.ratios.ebeSurCA)} du CA`}
        />
      </Box>

      {manques.map((m) => (
        <Alert key={m.onglet} severity="info" action={<Button color="inherit" onClick={() => allerA(m.onglet)} sx={{ minHeight: 48 }}>{m.action}</Button>} sx={{ alignItems: 'center' }}>
          {m.texte}
        </Alert>
      ))}

      {quoiFaire}

      <PlusLoin contenu={contenu}>
      <Card component="section" aria-label={`Chiffre d’affaires ${annee}`} sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h2" sx={{ flex: 1, minWidth: 200 }}>Chiffre d’affaires {annee}</Typography>
          <ToggleButtonGroup exclusive size="small" value={vue} onChange={(_, v: 'cumul' | 'mois' | null) => v && setVue(v)} aria-label="Affichage du chiffre d’affaires" className="pas-a-l-impression">
            <ToggleButton value="cumul" sx={{ minHeight: 48, textTransform: 'none', px: 2 }}>Cumulé</ToggleButton>
            <ToggleButton value="mois" sx={{ minHeight: 48, textTransform: 'none', px: 2 }}>Mois par mois</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {vue === 'cumul' ? (
          <GraphiqueMois
            titre={`Chiffre d’affaires ${annee} cumulé : réel jusqu’à ${finMois}, projection ensuite${budgetN ? ', comparé au budget' : ''} et à ${annee - 1}`}
            format={montant} formatAxe={milliers}
            series={[
              ...(budgetN ? [{ nom: `Budget ${annee}`, valeurs: cumul(budgetN.mois.map((m) => m.ca)), forme: 'ligne' as const, couleur: brand.orange }] : []),
              { nom: `Réel ${annee - 1}`, valeurs: cumul(s.serieN1), forme: 'ligne', couleur: brand.vert },
              { nom: 'Projection', valeurs: cumulApres(s.serieN, s.projection), forme: 'ligne', couleur: 'var(--mui-palette-text-secondary)', pointille: true },
              { nom: `Réel ${annee}`, valeurs: cumul(s.serieN), forme: 'ligne', couleur: 'var(--mui-palette-text-primary)' },
            ]}
          />
        ) : (
          <GraphiqueMois
            titre={`Chiffre d’affaires ${annee} : réel jusqu’à ${finMois}, projection ensuite, comparé à ${annee - 1}`}
            format={montant} formatAxe={milliers}
            series={[
              { nom: `Réel ${annee}`, valeurs: s.serieN, forme: 'barre', couleur: 'var(--mui-palette-text-primary)' },
              { nom: 'Projection', valeurs: s.projection, forme: 'barre', couleur: brand.beige },
              { nom: `Réel ${annee - 1}`, valeurs: s.serieN1, forme: 'ligne', couleur: brand.vert },
              ...(budgetN ? [{ nom: `Budget ${annee}`, valeurs: budgetN.mois.map((m) => m.ca), forme: 'ligne' as const, couleur: brand.orange, pointille: true }] : []),
            ]}
          />
        )}
      </Card>

      <LeviersCommerciaux budget={b} annee={annee} parametres={parametres} proposerAction={proposerAction} />
        {plusLoin}
      </PlusLoin>
    </Stack>
  )
}

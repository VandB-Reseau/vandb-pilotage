import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { EtatVide } from './EtatVide'
import { GraphiqueMois } from './GraphiqueMois'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { atterrissageDe, chargerReel, chargerSecours, type DonneesBudgets } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, montant, MOIS_LONGS, taux } from '../lib/format'
import { santeMagasin } from '../moteur/sante'
import type { ParametresReseau } from '../moteur/types'
import { brand } from '../theme/theme'

// Santé du magasin en un coup d'œil : cumul de l'année face à l'an dernier, marge, masse salariale, résultat attendu
export function SyntheseMagasin({ magasin, d, annee, parametres, allerA }: {
  magasin: string
  d: DonneesBudgets
  annee: number
  parametres: ParametresReseau
  allerA: (onglet: string) => void
}) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee)]).then(([n, n1, secours]) => ({ n, n1, secours })), [magasin, annee])

  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />

  const equipe = d.equipes[magasin]
  const frais = d.frais[magasin]
  const a = atterrissageDe(donnees, annee, equipe, frais, parametres, donnees.secours)
  const s = santeMagasin(donnees.n, donnees.n1, a?.budget ?? null)
  if (s.moisRealises === 0 || !a) {
    return (
      <EtatVide
        titre={`Pas encore de réel ${annee}`}
        texte={`La synthèse du magasin part des chiffres réels ${annee}, importés chaque mois ou saisis à la main.`}
        action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
      />
    )
  }
  const b = a.budget
  const finMois = MOIS_LONGS[s.moisRealises - 1]
  const manques = [
    !equipe?.length && { onglet: 'equipe', texte: 'Équipe non renseignée : la masse salariale compte pour zéro.', action: 'Renseigner l’équipe' },
    !frais?.length && { onglet: 'frais', texte: 'Frais non renseignés : seules la redevance et la publicité sont comptées.', action: 'Renseigner les frais' },
  ].filter((x): x is { onglet: string; texte: string; action: string } => !!x)

  return (
    <Stack spacing={3}>
      <Box component="section" aria-label={`Santé du magasin à fin ${finMois}`} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Indicateur
          libelle={`CA HT à fin ${finMois}`} valeur={milliers(s.caCumule)} serie={s.serieN}
          ecart={s.evolution === null ? undefined : { texte: `${taux(Math.abs(s.evolution))} sur ${annee - 1}`, hausse: s.evolution >= 0, favorable: s.evolution >= 0 }}
          detail={`Atterrissage ${annee} : ${milliers(b.ca)}`}
        />
        <Indicateur
          libelle="Marge commerciale" valeur={s.tauxMarge === null ? 'Non connue' : taux(s.tauxMarge)}
          detail={s.tauxMarge === null ? 'Marge absente des chiffres de caisse' : `${milliers(s.margeCumulee)} à fin ${finMois}`}
        />
        <Indicateur
          libelle="Masse salariale / marge" valeur={equipe?.length ? taux(b.ratios.personnelSurMarge) : 'À renseigner'}
          detail={equipe?.length ? `${milliers(b.personnel)} sur l’année` : 'Équipe non renseignée'}
        />
        <Indicateur
          libelle={`EBE attendu ${annee}`} valeur={milliers(b.ebe)} serie={b.mois.map((m) => m.ebe)}
          detail={`${taux(b.ratios.ebeSurCA)} du CA`}
        />
      </Box>

      {manques.map((m) => (
        <Alert key={m.onglet} severity="info" action={<Button color="inherit" onClick={() => allerA(m.onglet)} sx={{ minHeight: 48 }}>{m.action}</Button>} sx={{ alignItems: 'center' }}>
          {m.texte}
        </Alert>
      ))}

      <Card component="section" aria-label={`Chiffre d’affaires ${annee} mois par mois`} sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h2" sx={{ mb: 2 }}>Chiffre d’affaires {annee}</Typography>
        <GraphiqueMois
          titre={`Chiffre d’affaires ${annee} : réel jusqu’à ${finMois}, projection ensuite, comparé à ${annee - 1}`}
          format={montant} formatAxe={milliers}
          series={[
            { nom: `Réel ${annee}`, valeurs: s.serieN, forme: 'barre', couleur: 'var(--mui-palette-text-primary)' },
            { nom: 'Projection', valeurs: s.projection, forme: 'barre', couleur: brand.beige },
            { nom: `Réel ${annee - 1}`, valeurs: s.serieN1, forme: 'ligne', couleur: brand.vert },
          ]}
        />
      </Card>
    </Stack>
  )
}

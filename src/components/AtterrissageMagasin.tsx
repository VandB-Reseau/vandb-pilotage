import { useState } from 'react'
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
import { avecEquipeEtFrais, chargerReel, niveauxDe, proposerBudget, type DonneesBudgets, type LigneMagasin } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { MOIS_LONGS } from '../lib/format'
import { compteResultat } from '../moteur/compteResultat'
import { baseDepuisReel } from '../moteur/atterrissage'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles } from '../moteur/cibles'
import type { ParametresReseau } from '../moteur/types'

// Atterrissage de l'année en cours : réel des mois passés, projection des mois restants, équipe et frais du magasin.
// Le Directeur en tire la proposition du budget de l'an prochain.
export function AtterrissageMagasin({ ligne, d, annee, anneeBudget, parametres, directeur, allerA, apresProposition }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  anneeBudget: number
  parametres: ParametresReseau
  directeur: boolean
  allerA: (onglet: string) => void
  apresProposition: () => void
}) {
  const magasin = ligne.magasin
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1)]).then(([n, n1]) => ({ n, n1 })), [magasin, annee])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={240} />
  if (erreur || !donnees) return <Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />

  const r = baseDepuisReel(donnees, annee)
  if (!r) {
    return (
      <EtatVide
        titre={`Pas encore de réel ${annee}`}
        texte={`L’atterrissage ${annee} part des chiffres réels des mois passés.`}
        action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
      />
    )
  }

  const equipe = d.equipes[magasin]
  const frais = d.frais[magasin]
  const b = calculerBudget(avecEquipeEtFrais(r.base, equipe, frais), parametres)
  const peutProposer = directeur && ligne.statut !== 'valide'

  const proposer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      const base = { ...avecEquipeEtFrais(r.base, undefined, frais), annee: anneeBudget }
      const { hypotheses } = appliquerCibles(avecEquipeEtFrais(base, equipe, frais), niveauxDe(ligne, d))
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

      {peutProposer && (
        <Box>
          <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe} onClick={() => void proposer()} sx={{ minHeight: 48 }}>
            {ligne.base ? `Mettre à jour la proposition ${anneeBudget}` : `Proposer le budget ${anneeBudget}`}
          </Button>
        </Box>
      )}

      <CompteResultatMois
        lignes={compteResultat(b, r.base, parametres)} projeteA={r.moisRealises}
        titre={`Compte de résultat ${annee}`} libelleTableau={`Atterrissage ${annee} mois par mois`}
        entete={
          <Typography variant="body2" color="text.secondary">
            {`Réel jusqu’à ${MOIS_LONGS[r.moisRealises - 1]}, ${r.methode === 'saisonnalite' ? `projection sur la saisonnalité ${annee - 1}` : 'projection sur la moyenne des mois réalisés'}`}
          </Typography>
        }
      />
    </Stack>
  )
}

import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { CompteResultat } from './CompteResultat'
import { EtatVide } from './EtatVide'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { avecEquipeEtFrais, chargerReel, niveauxDe, proposerBudget, type DonneesBudgets, type LigneMagasin } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, montant, MOIS, MOIS_LONGS, taux } from '../lib/format'
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
  const manques = [
    !equipe?.length && { onglet: 'equipe', texte: 'Équipe non renseignée : la masse salariale compte pour zéro.', action: 'Renseigner l’équipe' },
    !frais?.length && { onglet: 'frais', texte: 'Frais non renseignés : seules la redevance et la publicité sont comptées.', action: 'Renseigner les frais' },
  ].filter((x): x is { onglet: string; texte: string; action: string } => !!x)
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

      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Atterrissage ${annee} en chiffres`}>
        <Indicateur libelle={`CA HT ${annee}`} valeur={milliers(b.ca)} detail={`Réalisé à fin ${MOIS_LONGS[r.moisRealises - 1]} : ${milliers(r.realise)}`} />
        <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} />
        <Indicateur libelle="Masse salariale / marge" valeur={taux(b.ratios.personnelSurMarge)} detail={milliers(b.personnel)} />
        <Indicateur libelle="EBE" valeur={milliers(b.ebe)} detail={`${taux(b.ratios.ebeSurCA)} du CA`} />
      </Stack>

      {manques.map((m) => (
        <Alert key={m.onglet} severity="info" action={<Button color="inherit" onClick={() => allerA(m.onglet)} sx={{ minHeight: 48 }}>{m.action}</Button>} sx={{ alignItems: 'center' }}>
          {m.texte}
        </Alert>
      ))}

      {peutProposer && (
        <Box>
          <Button variant="contained" startIcon={<SendOutlined />} disabled={occupe} onClick={() => void proposer()} sx={{ minHeight: 48 }}>
            {ligne.base ? `Mettre à jour la proposition ${anneeBudget}` : `Proposer le budget ${anneeBudget}`}
          </Button>
        </Box>
      )}

      <CompteResultat b={b} titre={`Compte de résultat ${annee}`} libelleTableau={`Atterrissage ${annee}`} />

      <Card component="section" aria-label="Atterrissage mois par mois">
        <Box sx={{ p: 2, pb: 0 }}>
          <Typography variant="h2">Mois par mois</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {r.methode === 'saisonnalite' ? `Mois restants projetés sur la saisonnalité ${annee - 1}` : 'Mois restants projetés sur la moyenne des mois réalisés'}
          </Typography>
        </Box>
        <TableContainer>
          <Table className="colonne-fixe" aria-label={`Atterrissage ${annee} mois par mois`}>
            <TableHead>
              <TableRow>
                <TableCell>Mois</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">CA HT</TableCell>
                <TableCell align="right">Marge</TableCell>
                <TableCell align="right">Personnel</TableCell>
                <TableCell align="right">EBE</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {b.mois.map((m, i) => {
                const projete = r.parMois[i].projete
                const style = { color: projete ? 'text.secondary' : undefined, whiteSpace: 'nowrap' }
                return (
                  <TableRow key={MOIS[i]}>
                    <TableCell sx={style}>{MOIS[i]}</TableCell>
                    <TableCell sx={style}>{projete ? 'Projection' : 'Réel'}</TableCell>
                    <TableCell align="right" sx={style}>{montant(m.ca)}</TableCell>
                    <TableCell align="right" sx={style}>{montant(m.marge)}</TableCell>
                    <TableCell align="right" sx={style}>{montant(m.personnel)}</TableCell>
                    <TableCell align="right" sx={{ ...style, color: m.ebe < 0 ? 'error.main' : style.color, fontWeight: m.ebe < 0 ? 700 : 400 }}>{montant(m.ebe)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  )
}

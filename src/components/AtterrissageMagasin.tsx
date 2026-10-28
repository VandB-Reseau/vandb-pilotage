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
import { avecEquipeEtFrais, chargerReel, chargerSecours, enregistrerPartsRealisees, niveauxDe, proposerBudget, type DonneesBudgets, type LigneMagasin, type PartsRealisees } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, MOIS_LONGS, montant, taux } from '../lib/format'
import { compteResultat } from '../moteur/compteResultat'
import { baseDepuisReel, type MethodeAtterrissage } from '../moteur/atterrissage'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles } from '../moteur/cibles'
import { UNIVERS, universLibelle, type ParametresReseau, type Univers } from '../moteur/types'
import { ChampTaux } from './ChampTaux'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { DetailCalcul } from './DetailCalcul'
import { Indicateur } from './Indicateur'

// Atterrissage de l'année en cours : réel des mois passés, projection des mois restants, équipe et frais du magasin.
// Le Directeur en tire la proposition du budget de l'an prochain.
const METHODE: Record<MethodeAtterrissage, string> = {
  saisie: 'Part saisie', rythme: 'Rythme des derniers mois (magasin de moins de 18 mois)', magasin: 'Saisonnalité du magasin l’an dernier', reseau: 'Saisonnalité médiane du réseau', moyenne: 'Moyenne des mois réalisés',
}

export function AtterrissageMagasin({ ligne, d, annee, anneeBudget, parametres, directeur, peutSaisir, allerA, apresProposition }: {
  ligne: LigneMagasin
  d: DonneesBudgets
  annee: number
  anneeBudget: number
  parametres: ParametresReseau
  directeur: boolean
  peutSaisir: boolean
  allerA: (onglet: string) => void
  apresProposition: () => void
}) {
  const magasin = ligne.magasin
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee)]).then(([n, n1, secours]) => ({ n, n1, secours })), [magasin, annee])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // Parts saisies en cours de frappe : null tant que rien n'a changé
  const [parts, setParts] = useState<PartsRealisees | null>(null)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={240} />
  if (erreur || !donnees) return <Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />

  const enregistrees = donnees.secours.parts ?? {}
  const vues = parts ?? enregistrees
  const r = baseDepuisReel(donnees, annee, [], undefined, { ...donnees.secours, parts: vues })
  const auto = baseDepuisReel(donnees, annee, [], undefined, { ...donnees.secours, parts: {} })
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

  const modifiees = parts !== null && JSON.stringify(parts) !== JSON.stringify(enregistrees)
  const enregistrerParts = async () => {
    if (!parts) return
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerPartsRealisees(magasin, annee, parts)
      setMessage({ gravite: 'success', texte: 'Parts de l’année réalisées enregistrées.' })
      setParts(null)
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  // Univers présents dans le réel de l'année
  const presents = UNIVERS.filter((u) => r.base.familles.some((f) => f.univers === u && f.caRealise > 0))
  const realiseDe = (u: Univers) => r.base.familles.filter((f) => f.univers === u).reduce((a, f) => a + f.caRealise, 0)

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

      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Atterrissage ${annee} en chiffres`}>
        <Indicateur libelle={`CA HT atterri ${annee}`} valeur={milliers(b.ca)} detail={`Dont réalisé : ${milliers(r.realise)}`}
          action={<DetailCalcul quoi="atterrissage" budget={b} annee={annee} atterrissage={r} />} />
        <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} action={<DetailCalcul quoi="marge" budget={b} annee={annee} />} />
        <Indicateur libelle="EBE" valeur={milliers(b.ebe)} detail={`${taux(b.ratios.ebeSurCA)} du CA`} action={<DetailCalcul quoi="ebe" budget={b} annee={annee} />} />
      </Stack>

      <CompteResultatMois
        lignes={compteResultat(b, r.base, parametres)} projeteA={r.moisRealises}
        titre={`Compte de résultat ${annee}`} libelleTableau={`Atterrissage ${annee} mois par mois`}
        entete={
          <Typography variant="body2" color="text.secondary">
            {`Réel jusqu’à ${MOIS_LONGS[r.moisRealises - 1]}, mois restants projetés par univers (voir plus bas)`}
          </Typography>
        }
      />

      <Card component="section" aria-label="Projection des mois restants">
        <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Projection des mois restants</Typography>
          {peutSaisir && modifiees && (
            <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe} onClick={() => void enregistrerParts()} sx={{ minHeight: 48 }}>Enregistrer les parts</Button>
          )}
        </Box>
        <Table size="small" aria-label={`Projection ${annee} par univers`} sx={{ '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Univers</TableCell>
              <TableCell align="right">Réalisé à fin {MOIS_LONGS[r.moisRealises - 1]}</TableCell>
              <TableCell>Projection</TableCell>
              <TableCell align="right">Part de l’année réalisée</TableCell>
              <TableCell align="right">Atterrissage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {presents.map((u) => (
              <TableRow key={u}>
                <TableCell>{universLibelle[u]}</TableCell>
                <TableCell align="right">{montant(realiseDe(u))}</TableCell>
                <TableCell>{METHODE[r.methodes[u]]}</TableCell>
                <TableCell align="right">
                  {peutSaisir
                    ? <ChampTaux libelle={`Part de l’année réalisée : ${universLibelle[u]}`} valeur={vues[u]} heritee={auto?.base.partRealisee?.[u]}
                        onChange={(v) => setParts(() => { const { [u]: _, ...reste } = vues; return v === undefined ? reste : { ...reste, [u]: v } })} />
                    : taux(r.base.partRealisee?.[u] ?? 0)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>{montant(realiseDe(u) / (r.base.partRealisee?.[u] || 1))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  )
}

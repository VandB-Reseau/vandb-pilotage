import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import { chargerActions, chargerQuadrimestres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { tachesFranchise, type TacheFranchise } from '../lib/aFaire'
import type { Statut } from '../data/pilotage'
import { MOIS_LONGS } from '../lib/format'
import { QUADRIMESTRES, quadrimestreLibelle } from '../moteur/quadrimestre'

const tache = (t: TacheFranchise): { texte: string; action: string; onglet: string; annee?: number; icone: React.ReactNode } => {
  switch (t.type) {
    case 'reel': return { texte: `Réel de ${MOIS_LONGS[t.mois]} à saisir`, action: 'Saisir', onglet: 'reel', icone: <EventBusyOutlined /> }
    case 'quadrimestre': return { texte: `Quadrimestre ${quadrimestreLibelle[t.quadrimestre].toLowerCase()} ${t.annee} à saisir`, action: 'Saisir', onglet: 'quadrimestres', annee: t.annee, icone: <ReceiptLongOutlined /> }
    case 'budget': return { texte: t.statut === 'propose' ? `Budget ${t.annee} proposé par le siège, à relire` : `Budget ${t.annee} en discussion`, action: 'Voir', onglet: 'budget', icone: <RequestQuoteOutlined /> }
    case 'equipe': return { texte: 'Équipe à renseigner', action: 'Renseigner', onglet: 'equipe', icone: <GroupsOutlined /> }
    case 'frais': return { texte: 'Frais à renseigner', action: 'Renseigner', onglet: 'frais', icone: <AssignmentOutlined /> }
    case 'action': return {
      texte: `Plan d’action : ${t.intitule}${t.echeance ? `, pour le ${new Date(`${t.echeance}T12:00:00`).toLocaleDateString('fr-FR')}` : ''}`,
      action: 'Voir', onglet: 'plan', icone: <TaskAltOutlined />,
    }
  }
}

// En tête de la fiche pour le franchisé : ce qu'il a à faire sur son magasin, chaque ligne mène à l'onglet
export function AFaireFranchise({ magasin, moisRenseignes, budget, aEquipe, aFrais, allerA }: {
  magasin: string
  moisRenseignes: number | null
  budget: { annee: number; statut: Statut | null }
  aEquipe: boolean
  aFrais: boolean
  allerA: (onglet: string, annee?: number) => void
}) {
  const n = new Date().getFullYear()
  const { donnees } = useChargement(() => Promise.all([chargerQuadrimestres(n), chargerQuadrimestres(n - 1), chargerActions().catch(() => [])]), [n])
  if (!donnees || moisRenseignes === null) return null
  const saisis = (q: (typeof donnees)[0]) => QUADRIMESTRES.filter((x) => q[magasin]?.[x])
  const actions = donnees[2].filter((a) => a.magasin === magasin && a.responsable === 'franchise' && a.statut === 'a_faire').map((a) => ({ intitule: a.intitule, echeance: a.echeance }))
  const taches = tachesFranchise({ moisRenseignes, quadrimestres: { [n]: saisis(donnees[0]), [n - 1]: saisis(donnees[1]) }, budget, aEquipe, aFrais, actions })

  return (
    <Card component="section" aria-label="À faire" sx={{ mb: 3 }}>
      {taches.length === 0 ? (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CheckCircleOutline color="success" />
          <Typography>Tout est à jour</Typography>
        </Box>
      ) : (
        <>
          <Typography variant="h2" sx={{ px: 2, pt: 2, pb: 1 }}>À faire</Typography>
          <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {taches.map((t) => {
              const x = tache(t)
              return (
                <Box component="li" key={`${t.type}-${x.texte}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.5, minHeight: 56, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ color: 'primary.main', display: 'flex' }} aria-hidden>{x.icone}</Box>
                  <Typography sx={{ flex: 1 }}>{x.texte}</Typography>
                  <Button variant="outlined" onClick={() => (x.onglet === 'plan' ? document.getElementById('plan-action')?.scrollIntoView({ behavior: 'smooth' }) : allerA(x.onglet, x.annee))} sx={{ minHeight: 48 }} aria-label={`${x.action} : ${x.texte}`}>{x.action}</Button>
                </Box>
              )
            })}
          </Stack>
        </>
      )}
    </Card>
  )
}

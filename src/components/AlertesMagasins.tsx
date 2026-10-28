import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined'
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined'
import PercentOutlined from '@mui/icons-material/PercentOutlined'
import TrendingDownOutlined from '@mui/icons-material/TrendingDownOutlined'
import { chargerActions, type Action } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartPts, ecartTaux, lienMagasin, montant, MOIS_LONGS, taux } from '../lib/format'
import { TYPES_ALERTE, type Alerte, type TypeAlerte } from '../moteur/alertes'

export const typeAlerteLibelle: Record<TypeAlerte, string> = { tresorerie: 'Trésorerie basse', ca: 'CA sous le budget', marge: 'Marge en baisse', reel: 'Réel en retard' }
const ICONE: Record<TypeAlerte, React.ReactNode> = {
  tresorerie: <AccountBalanceWalletOutlined />, ca: <TrendingDownOutlined />, marge: <PercentOutlined />, reel: <EventBusyOutlined />,
}
const FIN_QUADRIMESTRE = { 1: 'avril', 2: 'août', 3: 'décembre' } as const

export function texteAlerte(a: Alerte): string {
  switch (a.type) {
    case 'ca': return `CA ${ecartTaux(a.ecart)} face au budget à fin ${MOIS_LONGS[a.mois - 1]}`
    case 'marge': return `Taux de marge de ${taux(a.taux)}, ${ecartPts(a.ecart)} sur l’an dernier à fin ${MOIS_LONGS[a.mois - 1]}`
    case 'reel': return a.dernier === 0 ? 'Aucun mois de réel cette année'
      : `Réel arrêté à fin ${MOIS_LONGS[a.dernier - 1]}, ${a.manquants === 1 ? '1 mois manquant' : `${a.manquants} mois manquants`}`
    case 'tresorerie': return a.source === 'reel' ? `Trésorerie de ${montant(a.montant)} fin ${FIN_QUADRIMESTRE[a.quadrimestre]}`
      : `Budget ${a.annee} : trésorerie à ${montant(a.montant)} en ${MOIS_LONGS[a.mois - 1]}`
  }
}
// Onglet de la fiche où l'alerte se lit
const ongletDe = (a: Alerte) => (a.type === 'reel' ? 'reel' : a.type === 'tresorerie' ? (a.source === 'reel' ? 'quadrimestres' : 'budget') : 'suivi')

const PREMIERES = 6

// Alertes des magasins : filtre par type, les plus graves d'abord. Sur une fiche magasin (unMagasin), sans nom ni filtre.
export function AlertesMagasins({ alertes, etat, unMagasin, siVide = true, agir, actions: fournies }: {
  alertes: Alerte[]
  etat?: object
  unMagasin?: boolean
  siVide?: boolean   // affiche « Aucune alerte » quand la liste est vide
  agir?: (a: Alerte) => void   // fiche magasin, pour l'équipe : rattacher une action à l'alerte
  actions?: Action[]            // fiche magasin : déjà chargées, tenues à jour par le plan
}) {
  const [type, setType] = useState<TypeAlerte | null>(null)
  const [tout, setTout] = useState(false)
  // Alertes qui ont déjà une action en cours (sans la table des actions, aucune)
  const chargees = useChargement(() => (fournies ? Promise.resolve([]) : chargerActions().catch(() => [])), [!!fournies])
  const actions = fournies ?? chargees.donnees
  const suivie = (a: Alerte) => !!actions?.some((x) => x.magasin === a.magasin && x.type === a.type && x.statut === 'a_faire')
  if (!alertes.length) {
    if (!siVide) return null
    return (
      <Card component="section" aria-label="Alertes" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CheckCircleOutline color="success" />
        <Typography>Aucune alerte</Typography>
      </Card>
    )
  }
  const presents = TYPES_ALERTE.filter((t) => alertes.some((a) => a.type === t))
  const filtrees = type ? alertes.filter((a) => a.type === type) : alertes
  const vues = tout ? filtrees : filtrees.slice(0, PREMIERES)
  const nb = (t: TypeAlerte) => alertes.filter((a) => a.type === t).length

  return (
    <Card component="section" aria-label="Alertes">
      <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 160 }}>{alertes.length === 1 ? '1 alerte' : `${alertes.length} alertes`}</Typography>
        {!unMagasin && presents.length > 1 && (
          <ToggleButtonGroup exclusive size="small" value={type} onChange={(_, v: TypeAlerte | null) => { setType(v); setTout(false) }} aria-label="Type d’alerte" sx={{ flexWrap: 'wrap' }}>
            {presents.map((t) => <ToggleButton key={t} value={t} sx={{ minHeight: 48, textTransform: 'none' }}>{typeAlerteLibelle[t]} ({nb(t)})</ToggleButton>)}
          </ToggleButtonGroup>
        )}
      </Box>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {vues.map((a, i) => (
          <Box component="li" key={`${a.magasin}-${a.type}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, minHeight: 48, py: 0.75, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ color: a.type === 'reel' ? 'text.secondary' : 'error.main', display: 'flex' }} aria-hidden>{ICONE[a.type]}</Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', columnGap: 1.5, alignItems: 'baseline' }}>
              {!unMagasin && (
                <Link component={RouterLink} to={lienMagasin(a.magasin)} state={{ ...etat, onglet: ongletDe(a) }} sx={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>
                  {a.magasin}
                </Link>
              )}
              <Typography component="span">{texteAlerte(a)}</Typography>
              {suivie(a) && <Chip size="small" label="Action en cours" color="primary" variant="outlined" />}
            </Box>
            {agir && (
              <Button onClick={() => agir(a)} sx={{ minHeight: 48 }} aria-label={`Agir : ${texteAlerte(a)}`}>Agir</Button>
            )}
          </Box>
        ))}
      </Stack>
      {filtrees.length > PREMIERES && (
        <Box sx={{ px: 1, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setTout((t) => !t)} sx={{ minHeight: 48 }}>
            {tout ? 'Voir moins' : `Voir les ${filtrees.length} alertes`}
          </Button>
        </Box>
      )}
    </Card>
  )
}

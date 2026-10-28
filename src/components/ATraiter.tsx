import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import AssignmentLateOutlined from '@mui/icons-material/AssignmentLateOutlined'
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import ForumOutlined from '@mui/icons-material/ForumOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined'
import type { ATraiter as Item, Filtre } from '../lib/aFaire'
import { lienMagasin } from '../lib/format'
import { usePreference } from '../lib/preferences'

const pluriel = (n: number, un: string, plusieurs: string) => (n === 1 ? `1 ${un}` : `${n} ${plusieurs}`)
const ICONE: Record<Item['cle'], ReactNode> = {
  alertes: <NotificationsActiveOutlined />, actions: <AssignmentLateOutlined />, a_proposer: <EditNoteOutlined />,
  en_discussion: <ForumOutlined />, equipe: <GroupsOutlined />, frais: <ReceiptLongOutlined />,
}
const PREMIERS = 3

// « À traiter » en tête de l'accueil (lot 27) : ce qui attend le Directeur, le RR ou le Coach, chaque ligne mène à la liste
// filtrée ou aux magasins concernés ; repliable, le choix est gardé dans le navigateur
export function ATraiter({ items, annee, directeur, filtrer, etat }: {
  items: Item[]
  annee: number
  directeur: boolean
  filtrer: (f: Filtre) => void
  etat?: object
}) {
  const [ouvert, setOuvert] = usePreference<'ouvert' | 'ferme'>('a-traiter', 'ouvert', ['ouvert', 'ferme'])
  if (!items.length) {
    return (
      <Card component="section" aria-label="À traiter" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TaskAltOutlined color="success" />
        <Typography>Rien à traiter sur ton périmètre</Typography>
      </Card>
    )
  }
  const texte = (x: Item) => {
    switch (x.cle) {
      case 'alertes': return pluriel(x.nombre, 'magasin en alerte', 'magasins en alerte')
      case 'actions': return pluriel(x.nombre, 'action du plan en retard', 'actions du plan en retard')
      case 'a_proposer': return pluriel(x.nombre, `budget ${annee} à proposer`, `budgets ${annee} à proposer`)
      case 'en_discussion': return `${pluriel(x.nombre, 'budget en discussion', 'budgets en discussion')}${directeur ? ' : à valider ou à reprendre' : ''}`
      case 'equipe': return pluriel(x.nombre, 'équipe à renseigner', 'équipes à renseigner')
      case 'frais': return `Frais à renseigner dans ${pluriel(x.nombre, 'magasin', 'magasins')}`
    }
  }
  const allerAuxAlertes = () => document.querySelector('section[aria-label="Alertes"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <Card component="section" aria-label="À traiter">
      <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>À traiter</Typography>
        <Button onClick={() => setOuvert(ouvert === 'ouvert' ? 'ferme' : 'ouvert')} aria-expanded={ouvert === 'ouvert'} className="pas-a-l-impression"
          endIcon={ouvert === 'ouvert' ? <ExpandLessOutlined /> : <ExpandMoreOutlined />} sx={{ minHeight: 48 }}>
          {ouvert === 'ouvert' ? 'Replier' : `Voir les ${items.length} points`}
        </Button>
      </Box>
      <Collapse in={ouvert === 'ouvert'}>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {items.map((x) => (
            <Box component="li" key={x.cle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.5, minHeight: 56, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
              <Box aria-hidden sx={{ display: 'flex', color: x.cle === 'alertes' || x.cle === 'actions' ? 'error.main' : 'text.secondary' }}>{ICONE[x.cle]}</Box>
              <Box sx={{ flex: 1, minWidth: 200, display: 'flex', flexWrap: 'wrap', columnGap: 1.5, alignItems: 'baseline' }}>
                <Typography component="span" sx={{ fontWeight: 600 }}>{texte(x)}</Typography>
                {x.cle === 'actions' && x.magasins.slice(0, PREMIERS).map((m) => (
                  <Link key={m} component={RouterLink} to={lienMagasin(m)} state={{ ...etat, onglet: 'synthese' }} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>{m}</Link>
                ))}
                {x.cle === 'actions' && x.magasins.length > PREMIERS && (
                  <Typography component="span" color="text.secondary">et {pluriel(x.magasins.length - PREMIERS, 'autre', 'autres')}</Typography>
                )}
              </Box>
              {x.cle === 'alertes' && <Button onClick={allerAuxAlertes} sx={{ minHeight: 48 }}>Voir les alertes</Button>}
              {x.filtre && <Button onClick={() => filtrer(x.filtre!)} sx={{ minHeight: 48 }} aria-label={`Afficher ces magasins : ${texte(x)}`}>Afficher ces magasins</Button>}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Card>
  )
}

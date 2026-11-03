import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import AssignmentLateOutlined from '@mui/icons-material/AssignmentLateOutlined'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import GroupsOutlined from '@mui/icons-material/GroupsOutlined'
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import type { ATraiter as Item, Filtre } from '../lib/aFaire'
import { lienMagasin } from '../lib/format'
import { usePreference } from '../lib/preferences'

const pluriel = (n: number, un: string, plusieurs: string) => (n === 1 ? `1 ${un}` : `${n} ${plusieurs}`)
const ICONE: Record<Item['cle'], ReactNode> = {
  alertes: <NotificationsActiveOutlined />, actions: <AssignmentLateOutlined />, equipe: <GroupsOutlined />, frais: <ReceiptLongOutlined />,
}
const PREMIERS = 3

// « À traiter » (lot 27) : ce qui attend le Directeur, le RR ou le Coach, chaque ligne mène à la liste filtrée ou aux
// magasins concernés ; repliable, le choix est gardé dans le navigateur. Lot 43 : rangé dans le bandeau de la campagne,
// les étapes du budget n'y sont plus (elles sont dans la campagne) ; rien à traiter, rien d'affiché.
export function ATraiter({ items, filtrer, etat }: {
  items: Item[]
  filtrer: (f: Filtre) => void
  etat?: object
}) {
  const [ouvert, setOuvert] = usePreference<'ouvert' | 'ferme'>('a-traiter', 'ouvert', ['ouvert', 'ferme'])
  if (!items.length) return null
  const texte = (x: Item) => {
    switch (x.cle) {
      case 'alertes': return pluriel(x.nombre, 'magasin en alerte', 'magasins en alerte')
      case 'actions': return pluriel(x.nombre, 'action du plan en retard', 'actions du plan en retard')
      case 'equipe': return pluriel(x.nombre, 'équipe à renseigner', 'équipes à renseigner')
      case 'frais': return `Frais à renseigner dans ${pluriel(x.nombre, 'magasin', 'magasins')}`
    }
  }

  return (
    <Box component="section" aria-label="À traiter" sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h3" sx={{ flex: 1 }}>À traiter</Typography>
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
                  <Link key={m} component={RouterLink} to={lienMagasin(m)} state={etat} sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 48 }}>{m}</Link>
                ))}
                {x.cle === 'actions' && x.magasins.length > PREMIERS && (
                  <Typography component="span" color="text.secondary">et {pluriel(x.magasins.length - PREMIERS, 'autre', 'autres')}</Typography>
                )}
              </Box>
              {(x.cle === 'alertes' || x.cle === 'actions') && <Button component={RouterLink} to="/reseau" sx={{ minHeight: 48 }}>Voir dans Ma semaine</Button>}
              {x.filtre && <Button onClick={() => filtrer(x.filtre!)} sx={{ minHeight: 48 }} aria-label={`Afficher ces magasins : ${texte(x)}`}>Afficher ces magasins</Button>}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

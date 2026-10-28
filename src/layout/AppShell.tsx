import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import GlobalStyles from '@mui/material/GlobalStyles'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined'
import { GardeSaisie } from '../components/GardeSaisie'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { estDirecteur, estEquipe, roleLibelle } from '../auth/roles'
import { installerChampSuivant } from '../lib/champSuivant'
import { brandStripe } from '../theme/theme'

const LARGEUR_MENU = 248

interface Destination { chemin: string; nom: string; court?: string; icone: ReactNode }

// Page imprimée (budget, vue réseau) : A4 paysage, sans menus ni boutons, tableaux en entier, texte à 9 pt (12 px)
const impression = {
  '.impression-seule': { display: 'none' },
  '@page': { size: 'A4 landscape', margin: '10mm' },
  '@media print': {
    'body, .fond-app': { backgroundColor: '#ffffff !important' },
    '*': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
    '.pas-a-l-impression, .MuiTabs-root, .MuiAlert-root, .MuiIconButton-root, .MuiTableSortLabel-icon': { display: 'none !important' },
    '.impression-seule': { display: 'inline' },
    main: { marginLeft: '0 !important', padding: '0 !important', maxWidth: 'none !important' },
    '.MuiCard-root': { boxShadow: 'none !important', border: '1px solid #d6d6d6', overflow: 'visible !important' },
    '.MuiTableContainer-root': { overflow: 'visible !important' },
    'table.colonne-fixe tr > *, table.deux-colonnes-fixes tr > *': { position: 'static !important', boxShadow: 'none !important' },
    'table td, table th': { fontSize: '9pt !important', paddingTop: '3px !important', paddingBottom: '3px !important', minHeight: '0 !important' },
    'table a, table .MuiButtonBase-root': { minHeight: '0 !important' },
    // Champs de saisie imprimés comme du texte : valeur ou valeur reprise du niveau au-dessus, sans cadre
    '.MuiOutlinedInput-notchedOutline': { border: 'none !important' },
    'input::placeholder': { color: 'inherit !important', opacity: '1 !important' },
    tr: { breakInside: 'avoid' },
    'section, .MuiCard-root': { breakInside: 'auto' },
  },
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const { profil, deconnexion } = useAuth()
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const { pathname } = useLocation()
  const [menuCompte, setMenuCompte] = useState<HTMLElement | null>(null)
  useEffect(installerChampSuivant, [])

  // Hypothèses, imports de caisse et paramètres réseau : Directeur seul, comme les référentiels de l'app réseau
  const destinations: Destination[] = [
    { chemin: '/', nom: 'Magasins', icone: <StorefrontOutlined /> },
    ...(estEquipe(profil) ? [{ chemin: '/reseau', nom: 'Réseau', icone: <LeaderboardOutlined /> }] : []),
    ...(estDirecteur(profil) ? [
      { chemin: '/hypotheses', nom: 'Hypothèses', icone: <TrendingUpOutlined /> },
      { chemin: '/imports', nom: 'Imports de caisse', court: 'Imports', icone: <UploadFileOutlined /> },
      { chemin: '/parametres', nom: 'Paramètres réseau', court: 'Paramètres', icone: <TuneOutlined /> },
    ] : []),
  ]
  const active = destinations.find((d) => d.chemin !== '/' && pathname.startsWith(d.chemin))?.chemin ?? '/'

  return (
    <GardeSaisie>
    <Box className="fond-app" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Ce qu'on fait défiler jusqu'à l'écran ne se cache ni sous la barre du haut, ni sous la barre basse du téléphone */}
      <GlobalStyles styles={{ html: { scrollPaddingTop: 80, scrollPaddingBottom: telephone && destinations.length > 1 ? 88 : 0 } }} />
      <GlobalStyles styles={impression} />
      <AppBar position="sticky" className="pas-a-l-impression" sx={{ bgcolor: '#1d1d1b', color: '#ffffff', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Box component={RouterLink} to="/" aria-label="Accueil du pilotage" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', minHeight: 48 }}>
            <Logo size={18} />
            <Typography variant="h3" component="span" sx={{ fontSize: '1.125rem' }}>Pilotage</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <IconButton color="inherit" aria-label="Mon compte" onClick={(e) => setMenuCompte(e.currentTarget)} sx={{ width: 48, height: 48 }}>
            <AccountCircleOutlined />
          </IconButton>
          <Menu anchorEl={menuCompte} open={!!menuCompte} onClose={() => setMenuCompte(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{profil?.nom}</Typography>
              <Typography variant="caption" color="text.secondary">{profil ? roleLibelle[profil.role] : ''}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setMenuCompte(null); void deconnexion() }} sx={{ minHeight: 48 }}>
              <ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>Se déconnecter
            </MenuItem>
          </Menu>
        </Toolbar>
        <Box aria-hidden sx={{ height: 4, background: brandStripe }} />
      </AppBar>

      {!telephone && (
        <Drawer variant="permanent" className="pas-a-l-impression" sx={{ width: LARGEUR_MENU, flexShrink: 0, '& .MuiDrawer-paper': { width: LARGEUR_MENU, boxSizing: 'border-box', top: 68, height: 'calc(100% - 68px)', p: 1.5 } }}>
          <List component="nav" aria-label="Menu principal">
            {destinations.map((d) => (
              <ListItemButton key={d.chemin} component={RouterLink} to={d.chemin} selected={active === d.chemin} sx={{ minHeight: 48, mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>{d.icone}</ListItemIcon>
                <ListItemText primary={d.nom} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{ ml: telephone ? 0 : `${LARGEUR_MENU}px`, px: { xs: 2, md: 5 }, pt: { xs: 2, md: 4 }, pb: telephone && destinations.length > 1 ? 12 : 6, maxWidth: 1440 }}>
        {children}
      </Box>

      {telephone && destinations.length > 1 && (
        <Paper className="pas-a-l-impression" sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderTop: 1, borderColor: 'divider', zIndex: (t) => t.zIndex.appBar }}>
          <BottomNavigation showLabels value={active} component="nav" aria-label="Menu principal">
            {destinations.map((d) => (
              <BottomNavigationAction key={d.chemin} value={d.chemin} label={d.court ?? d.nom} icon={d.icone} component={RouterLink} to={d.chemin} sx={{ minHeight: 56 }} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
    </GardeSaisie>
  )
}

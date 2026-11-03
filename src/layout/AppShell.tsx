import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import GlobalStyles from '@mui/material/GlobalStyles'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined'
import MenuOutlined from '@mui/icons-material/MenuOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined'
import { GardeSaisie } from '../components/GardeSaisie'
import { Logo } from '../components/Logo'
import { RechercheMagasin } from '../components/RechercheMagasin'
import { useAuth } from '../auth/AuthContext'
import { estDirecteur, estEquipe, libelleProfil, seulementParametres, voitParametres } from '../auth/roles'
import { installerChampSuivant } from '../lib/champSuivant'
import { magasinDeChemin } from '../lib/navigation'
import { brandStripe } from '../theme/theme'

const LARGEUR_MENU = 264 // comme l'app réseau (Joseph, 03/11/2026)

interface Destination { chemin: string; nom: string; icone: ReactNode }


// Page imprimée (budget, vue réseau) : A4 paysage, sans menus ni boutons, tableaux en entier, texte à 9 pt (12 px)
const impression = {
  '.impression-seule': { display: 'none' },
  // Parties du budget masquées à l'écran (lot 27) : imprimées avec la partie affichée, pour garder le budget complet sur papier
  '.partie-cachee': { display: 'none !important' },
  // Détail replié (lot 38) : caché à l'écran, imprimé
  '.repli-ferme': { display: 'none' },
  '@page': { size: 'A4 landscape', margin: '10mm' },
  // Fiche de visite (lot 28) : A4 portrait, seule sur la page imprimée
  '@page fiche': { size: 'A4 portrait', margin: '12mm' },
  '@media print': {
    'body, .fond-app': { backgroundColor: '#ffffff !important' },
    '*': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
    '.pas-a-l-impression, .MuiTabs-root, .MuiAlert-root, .MuiIconButton-root, .MuiTableSortLabel-icon': { display: 'none !important' },
    '.impression-seule': { display: 'inline' },
    '.partie-cachee': { display: 'block !important' },
    '.repli-ferme': { display: 'block !important' },
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
    'body.fiche-seule #root': { display: 'none !important' },
    'body.fiche-seule .fiche-visite': { position: 'static !important' },
    'body.fiche-seule .fiche-visite .MuiBackdrop-root': { display: 'none !important' },
    'body.fiche-seule .fiche-visite .MuiDialog-container': { display: 'block !important', height: 'auto !important' },
    'body.fiche-seule .fiche-visite .MuiDialog-paper': { page: 'fiche', margin: '0 !important', maxWidth: 'none !important', maxHeight: 'none !important', boxShadow: 'none !important', overflow: 'visible !important' },
    'body.fiche-seule .fiche-visite .MuiDialogContent-root': { overflow: 'visible !important', padding: '0 !important' },
  },
} as const

export function AppShell({ children }: { children: ReactNode }) {
  const { profil, deconnexion } = useAuth()
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const { pathname } = useLocation()
  const [menuCompte, setMenuCompte] = useState<HTMLElement | null>(null)
  useEffect(installerChampSuivant, [])

  const [menuTelephone, setMenuTelephone] = useState(false)
  useEffect(() => setMenuTelephone(false), [pathname])

  // Joseph (03/11/2026) : comme dans l'app réseau, le menu de gauche mène aux thèmes ; les pages d'un magasin
  // (Données, Budget, Suivi) sont des onglets de sa fiche. Plus de magasin imposé : hors d'une fiche, on est au réseau.
  const fiche = magasinDeChemin(pathname)
  const actif = (chemin: string) => !fiche && (chemin === '/' ? pathname === '/' : pathname.startsWith(chemin))
  const lien = (d: Destination) => (
    <ListItemButton key={d.chemin} component={RouterLink} to={d.chemin} selected={actif(d.chemin)} aria-current={actif(d.chemin) ? 'page' : undefined} sx={{ minHeight: 48, mb: 0.25 }}>
      <ListItemIcon sx={{ minWidth: 40 }}>{d.icone}</ListItemIcon>
      <ListItemText primary={d.nom} />
    </ListItemButton>
  )
  const sousTitre = (t: string) => (
    <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '36px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary', px: 1 }}>{t}</ListSubheader>
  )
  // Option A (Joseph, 03/11/2026) : comme l'app réseau, le menu liste ce qui porte sur tout le réseau ; tout ce qui
  // concerne un magasin est dans sa fiche. Les réglages du Directeur sont rangés sous « Paramètres ».
  const principales: Destination[] = seulementParametres(profil) ? [] : [
    { chemin: '/', nom: profil?.role === 'franchise' ? 'Mes magasins' : 'Magasins', icone: <StorefrontOutlined /> },
    ...(estEquipe(profil) ? [{ chemin: '/reseau', nom: 'Réel du réseau', icone: <LeaderboardOutlined /> }] : []),
  ]
  const reglages: Destination[] = [
    ...(estDirecteur(profil) ? [{ chemin: '/hypotheses', nom: 'Hypothèses du réseau', icone: <TrendingUpOutlined /> }] : []),
    ...(estDirecteur(profil) ? [{ chemin: '/imports', nom: 'Imports de caisse', icone: <UploadFileOutlined /> }] : []),
    ...(voitParametres(profil) ? [{ chemin: '/parametres', nom: 'Paramètres réseau', icone: <TuneOutlined /> }] : []),
  ]
  const contenuMenu = (
    <List component="nav" aria-label="Menu principal" dense disablePadding>
      {principales.map(lien)}
      {reglages.length > 0 && <Divider sx={{ my: 1.5, mx: 1 }} />}
      {reglages.length > 0 && sousTitre('Paramètres')}
      {reglages.map(lien)}
    </List>
  )
  const avecMenu = !!profil && (profil.role !== 'aucun' || seulementParametres(profil))

  return (
    <GardeSaisie>
    <Box className="fond-app" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Ce qu'on fait défiler jusqu'à l'écran ne se cache ni sous la barre du haut, ni sous la barre basse du téléphone */}
      <GlobalStyles styles={{ html: { scrollPaddingTop: 88, scrollPaddingBottom: 0, '--barre-basse': '0px' } }} />
      <GlobalStyles styles={impression} />
      {/* Joseph (03/11/2026) : barre du haut à l'identique de l'app réseau (noir, 68 px sur PC, logo et nom, recherche au centre) */}
      <AppBar position="sticky" className="pas-a-l-impression" sx={{ bgcolor: '#000000', color: '#ffffff', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: { xs: 60, md: 68 }, gap: { xs: 0.5, sm: 2 } }}>
          {telephone && avecMenu && (
            <IconButton color="inherit" aria-label="Ouvrir le menu" onClick={() => setMenuTelephone(true)} sx={{ width: 48, height: 48, ml: -1 }}><MenuOutlined /></IconButton>
          )}
          <Box component={RouterLink} to="/" aria-label="Accueil du pilotage" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', minHeight: 48, width: telephone ? 'auto' : LARGEUR_MENU - 24 }}>
            <Logo size={telephone ? 20 : 22} />
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline' } }}>Pilotage</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: telephone ? 'flex-end' : 'center' }}>
            {profil && profil.role !== 'aucun' && <RechercheMagasin telephone={telephone} />}
          </Box>
          <IconButton color="inherit" aria-label="Mon compte" onClick={(e) => setMenuCompte(e.currentTarget)} sx={{ width: 48, height: 48 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 600 }}>{(profil?.nom ?? '').slice(0, 1).toUpperCase() || <AccountCircleOutlined />}</Avatar>
          </IconButton>
          <Menu anchorEl={menuCompte} open={!!menuCompte} onClose={() => setMenuCompte(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{profil?.nom}</Typography>
              <Typography variant="caption" color="text.secondary">{profil ? libelleProfil(profil) : ''}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setMenuCompte(null); void deconnexion() }} sx={{ minHeight: 48 }}>
              <ListItemIcon><LogoutOutlined fontSize="small" /></ListItemIcon>Se déconnecter
            </MenuItem>
          </Menu>
        </Toolbar>
        <Box aria-hidden sx={{ height: 4, background: brandStripe }} />
      </AppBar>

      {!telephone && avecMenu && (
        <Drawer variant="permanent" className="pas-a-l-impression" sx={{ width: LARGEUR_MENU, flexShrink: 0, '& .MuiDrawer-paper': { width: LARGEUR_MENU, boxSizing: 'border-box', top: 72, height: 'calc(100% - 72px)', p: 1.5, borderRight: '1px solid', borderColor: 'divider', bgcolor: 'background.default' } }}>
          {contenuMenu}
        </Drawer>
      )}
      {telephone && avecMenu && (
        <Drawer open={menuTelephone} onClose={() => setMenuTelephone(false)} className="pas-a-l-impression" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuTelephone(false) }} sx={{ zIndex: (t) => t.zIndex.modal, '& .MuiDrawer-paper': { width: 300, maxWidth: '85vw', p: 1.5 } }}>
          {contenuMenu}
        </Drawer>
      )}

      <Box component="main" sx={{ ml: telephone || !avecMenu ? 0 : `${LARGEUR_MENU}px`, px: { xs: 2, md: 5 }, pt: { xs: 2, md: 4 }, pb: 6, maxWidth: 1440 }}>
        {children}
      </Box>

    </Box>
    </GardeSaisie>
  )
}

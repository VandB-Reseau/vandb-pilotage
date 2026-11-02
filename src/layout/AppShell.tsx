import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Box from '@mui/material/Box'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
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
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import InsightsOutlined from '@mui/icons-material/InsightsOutlined'
import MenuOutlined from '@mui/icons-material/MenuOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined'
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined'
import { GardeSaisie } from '../components/GardeSaisie'
import { Logo } from '../components/Logo'
import { RechercheMagasin, SelecteurMagasin } from '../components/RechercheMagasin'
import { useAuth } from '../auth/AuthContext'
import { estDirecteur, estEquipe, roleLibelle } from '../auth/roles'
import { installerChampSuivant } from '../lib/champSuivant'
import { lienMagasin } from '../lib/format'
import { ESPACES, PARTIE_PAR_DEFAUT, espaceDe, espaceDePage, etapeDe, magasinDeChemin, partieDe, partiesDe, type Espace } from '../lib/navigation'
import { anneeBudget } from '../data/pilotage'
import { MenuMagasin } from './menuMagasin'
import { brandStripe } from '../theme/theme'

const LARGEUR_MENU = 248

interface Destination { chemin: string; nom: string; icone: ReactNode }

const ICONES_ESPACE: Record<Espace, ReactNode> = { donnees: <UploadFileOutlined />, budget: <AccountBalanceOutlined />, suivi: <InsightsOutlined /> }

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
  const [pastilles, setPastilles] = useState<Record<string, boolean>>({})
  const publierPastilles = useCallback((p: Record<string, boolean>) => setPastilles(p), [])
  useEffect(() => setMenuTelephone(false), [pathname])

  // Lot 36 : trois espaces. L'espace et le magasin affichés viennent de l'adresse ; sur une page qui n'appartient à aucun
  // espace (paramètres), on garde le dernier espace et le dernier magasin ouverts.
  const fiche = magasinDeChemin(pathname)
  const [dernier, setDernier] = useState<{ espace: Espace; magasin: string | null }>({ espace: 'budget', magasin: null })
  const espace: Espace = fiche?.partie ? espaceDe(fiche.partie) : espaceDePage(pathname) ?? dernier.espace
  const magasin = fiche?.nom ?? dernier.magasin
  useEffect(() => {
    if (espace !== dernier.espace || magasin !== dernier.magasin) setDernier({ espace, magasin })
  }, [espace, magasin]) // eslint-disable-line react-hooks/exhaustive-deps
  const partieActive = fiche?.partie ? partieDe(fiche.partie) : null

  // Pages du réseau de chaque espace : imports, hypothèses et paramètres au Directeur seul, comme dans l'app réseau
  const reseau: Record<Espace, Destination[]> = {
    donnees: estDirecteur(profil) ? [{ chemin: '/imports', nom: 'Imports de caisse', icone: <UploadFileOutlined /> }] : [],
    budget: [
      { chemin: '/', nom: profil?.role === 'franchise' ? 'Mes magasins' : `Campagne ${anneeBudget()}`, icone: <StorefrontOutlined /> },
      ...(estDirecteur(profil) ? [{ chemin: '/hypotheses', nom: 'Hypothèses du réseau', icone: <TrendingUpOutlined /> }] : []),
    ],
    suivi: estEquipe(profil) ? [{ chemin: '/reseau', nom: 'Réel du réseau', icone: <LeaderboardOutlined /> }] : [],
  }
  const cibleEspace = (e: Espace) => (magasin ? lienMagasin(magasin, PARTIE_PAR_DEFAUT[e]) : reseau[e][0]?.chemin ?? '/')
  const parties = partiesDe(espace)
  // Passer d'une étape du budget à l'autre garde les ajustements en cours : pas de confirmation (sauf en quittant l'équipe)
  const libre = (cle: string) => espace === 'budget' && partieActive !== null && partieActive !== 'equipe' && partieActive !== 'depart' && espaceDe(cle) === 'budget'
  const actif = (chemin: string) => !fiche && (chemin === '/' ? pathname === '/' : pathname.startsWith(chemin))

  const lien = (d: Destination) => (
    <ListItemButton key={d.chemin} component={RouterLink} to={d.chemin} selected={actif(d.chemin)} aria-current={actif(d.chemin) ? 'page' : undefined} sx={{ minHeight: 48, mb: 0.25 }}>
      <ListItemIcon sx={{ minWidth: 40 }}>{d.icone}</ListItemIcon>
      <ListItemText primary={d.nom} />
    </ListItemButton>
  )
  const sousTitre = (t: string) => (
    <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', px: 1 }}>{t}</ListSubheader>
  )
  const contenuMenu = (
    <>
      <Box role="group" aria-label="Espaces" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, p: 0.5, mb: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
        {ESPACES.map((e) => (
          <Button key={e.cle} component={RouterLink} to={cibleEspace(e.cle)} aria-current={e.cle === espace ? 'true' : undefined}
            sx={{ minHeight: 48, px: 0.5, fontWeight: 700, fontSize: '0.875rem', color: 'text.primary', borderRadius: 1.5,
              ...(e.cle === espace ? { bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } } : {}) }}>
            {e.libelle}
          </Button>
        ))}
      </Box>
      <List component="nav" aria-label="Menu principal" dense disablePadding>
        {reseau[espace].length > 0 && profil?.role !== 'franchise' && sousTitre('Réseau')}
        {reseau[espace].map(lien)}
        {magasin && (
          <>
            {sousTitre('Magasin')}
            <Box sx={{ mb: 0.5 }}><SelecteurMagasin magasin={magasin} /></Box>
            {parties.map((p) => (
              <ListItemButton key={p.cle} component={RouterLink} to={lienMagasin(magasin, p.cle)} selected={partieActive !== null && etapeDe(partieActive) === p.cle} aria-current={partieActive !== null && etapeDe(partieActive) === p.cle ? 'page' : undefined}
                data-sans-garde={libre(p.cle) ? '' : undefined} sx={{ minHeight: 48, mb: 0.25, pl: 2 }}>
                <ListItemText primary={
                  <Badge variant="dot" color="warning" invisible={!pastilles[p.cle] || fiche?.nom !== magasin} sx={{ '& .MuiBadge-dot': { right: -8, top: 4 } }}>{p.libelle}</Badge>
                } />
              </ListItemButton>
            ))}
          </>
        )}
        {!magasin && profil?.role !== 'franchise' && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1.5 }}>Ouvre un magasin pour voir ses pages.</Typography>
        )}
        {estDirecteur(profil) && sousTitre('Réglages')}
        {estDirecteur(profil) && lien({ chemin: '/parametres', nom: 'Paramètres réseau', icone: <TuneOutlined /> })}
      </List>
    </>
  )
  const avecMenu = !!profil && profil.role !== 'aucun'

  return (
    <GardeSaisie>
    <Box className="fond-app" sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      {/* Ce qu'on fait défiler jusqu'à l'écran ne se cache ni sous la barre du haut, ni sous la barre basse du téléphone */}
      <GlobalStyles styles={{ html: { scrollPaddingTop: 80, scrollPaddingBottom: telephone && avecMenu ? 88 : 0, '--barre-basse': telephone && avecMenu ? '72px' : '0px' } }} />
      <GlobalStyles styles={impression} />
      <AppBar position="sticky" className="pas-a-l-impression" sx={{ bgcolor: '#1d1d1b', color: '#ffffff', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          {telephone && avecMenu && (
            <IconButton color="inherit" aria-label="Ouvrir le menu" onClick={() => setMenuTelephone(true)} sx={{ width: 48, height: 48, ml: -1 }}><MenuOutlined /></IconButton>
          )}
          <Box component={RouterLink} to="/" aria-label="Accueil du pilotage" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', minHeight: 48 }}>
            <Logo size={18} />
            <Typography variant="h3" component="span" sx={{ fontSize: '1.125rem' }}>Pilotage</Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: telephone ? 'flex-end' : 'flex-start', pl: telephone ? 0 : `${LARGEUR_MENU - 160}px` }}>
            {profil && profil.role !== 'aucun' && <RechercheMagasin telephone={telephone} />}
          </Box>
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

      {!telephone && avecMenu && (
        <Drawer variant="permanent" className="pas-a-l-impression" sx={{ width: LARGEUR_MENU, flexShrink: 0, '& .MuiDrawer-paper': { width: LARGEUR_MENU, boxSizing: 'border-box', top: 68, height: 'calc(100% - 68px)', p: 1.5 } }}>
          {contenuMenu}
        </Drawer>
      )}
      {telephone && avecMenu && (
        <Drawer open={menuTelephone} onClose={() => setMenuTelephone(false)} className="pas-a-l-impression" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuTelephone(false) }} sx={{ zIndex: (t) => t.zIndex.modal, '& .MuiDrawer-paper': { width: 300, maxWidth: '85vw', p: 1.5 } }}>
          {contenuMenu}
        </Drawer>
      )}

      <Box component="main" sx={{ ml: telephone || !avecMenu ? 0 : `${LARGEUR_MENU}px`, px: { xs: 2, md: 5 }, pt: { xs: 2, md: 4 }, pb: telephone && avecMenu ? 12 : 6, maxWidth: 1440 }}>
        <MenuMagasin.Provider value={publierPastilles}>{children}</MenuMagasin.Provider>
      </Box>

      {/* Téléphone : les trois espaces en bas, le reste du menu derrière l'icône en haut à gauche */}
      {telephone && avecMenu && (
        <Paper className="pas-a-l-impression" sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, borderTop: 1, borderColor: 'divider', zIndex: (t) => t.zIndex.appBar }}>
          <BottomNavigation showLabels value={espace} component="nav" aria-label="Espaces du pilotage">
            {ESPACES.map((e) => (
              <BottomNavigationAction key={e.cle} value={e.cle} label={e.libelle} icon={ICONES_ESPACE[e.cle]} component={RouterLink} to={cibleEspace(e.cle)} sx={{ minHeight: 56 }} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
    </GardeSaisie>
  )
}

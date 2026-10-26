import { createTheme, type Theme } from '@mui/material/styles'

// Charte graphique V and B (guideline officielle) : couleurs en duos, aucune autre teinte, pas de bleu
export const brand = {
  noir: '#1d1d1b',
  noirProfond: '#000000',
  anthracite: '#312e2e',
  or: '#f8bb09',
  jaune: '#f7d802',
  orange: '#ea6029',
  brique: '#c24119',
  creme: '#feedd8',
  beige: '#ede0c4',
  vert: '#3a8f8d',
  vertFonce: '#307672',
}

// Filet sous l'en-tête : deux aplats jaune-or et vert canard, sans dégradé (la charte travaille en aplats)
export const brandStripe = `linear-gradient(90deg, ${brand.or} 0 62%, ${brand.vert} 62% 100%)`

// Polices : Lato (charte) pour le texte ; Alegreya, police libre proche de Coline (titres de la charte, sans fichier web), pour les titres
const fontFamily = '"Lato", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const titres = `"Alegreya", Georgia, serif`

const base = createTheme()

// Une seule couleur forte par ligne (Joseph, 21/10/2026) : le rouge reste une pastille pleine,
// orange, bleu et vert deviennent un texte coloré précédé d'un point, sans fond.
export type CouleurSignal = 'warning' | 'info' | 'success'
export function styleSignal(theme: Theme, couleur: CouleurSignal) {
  return {
    backgroundColor: 'transparent', color: theme.vars!.palette[couleur].dark, fontWeight: 600,
    '&::before': { content: '""', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'currentColor', flexShrink: 0 },
    '&:has(.MuiChip-icon)::before': { display: 'none' },
    '& .MuiChip-icon': { color: 'inherit' },
    '&.MuiChip-clickable:hover': { backgroundColor: theme.vars!.palette.action.hover },
    ...theme.applyStyles('dark', { color: theme.vars!.palette[couleur].light }),
  }
}
const telephone = base.breakpoints.down('sm')

export const theme = createTheme({
  // Aucune animation (choix de Joseph, 20/10/2026) : chaque écran, menu et fenêtre s'affiche aussitôt
  transitions: { create: () => 'none', duration: { shortest: 0, shorter: 0, short: 0, standard: 0, complex: 0, enteringScreen: 0, leavingScreen: 0 } },
  // Mode clair / sombre suivi automatiquement depuis le réglage de l'appareil
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brand.noir, contrastText: '#ffffff' },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: brand.anthracite, dark: brand.anthracite },
        // Orange de la charte trop clair pour un texte sur blanc : sa nuance foncée sert au texte
        warning: { main: brand.orange, dark: '#b84a1e' },
        error: { main: brand.brique },
        success: { main: brand.vert, dark: brand.vertFonce },
        background: { default: '#fbf7f0', paper: '#ffffff' },
        text: { primary: brand.noir, secondary: '#5a5550' },
        divider: '#ebe3d6',
        action: { selected: 'rgba(248, 187, 9, 0.28)' },
      },
    },
    dark: {
      palette: {
        primary: { main: brand.or, contrastText: brand.noir },
        secondary: { main: brand.or, contrastText: brand.noir },
        info: { main: '#e6e1da', light: '#e6e1da' },
        warning: { main: brand.or, light: brand.or },
        error: { main: brand.orange },
        success: { main: '#5fb3b0', light: '#5fb3b0' },
        background: { default: '#1d1d1b', paper: '#312e2e' },
        text: { primary: '#f2f2f0', secondary: '#b4b4ba' },
        divider: '#4a4545',
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily,
    // Aucune taille sous 12 px dans l'app
    // Titres de page compacts sur téléphone, pour laisser la place au contenu
    h1: { fontFamily: titres, fontSize: '2rem', fontWeight: 800, letterSpacing: '0.01em', textTransform: 'uppercase', [telephone]: { fontSize: '1.375rem' } },
    h2: { fontFamily: titres, fontSize: '1.5rem', fontWeight: 700 },
    h3: { fontFamily: titres, fontSize: '1.25rem', fontWeight: 700 },
    h4: { fontSize: '1.125rem', fontWeight: 700 },
    h5: { fontSize: '1rem', fontWeight: 700 },
    h6: { fontSize: '1rem', fontWeight: 700 },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
    button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
    caption: { fontSize: '0.75rem' },
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em' },
  },
  components: {
    MuiChip: {
      variants: (['warning', 'info', 'success'] as const).map((couleur) => ({
        props: { variant: 'filled' as const, color: couleur },
        style: ({ theme }: { theme: Theme }) => ({ ...styleSignal(theme, couleur), '&::before': { ...styleSignal(theme, couleur)['&::before'], marginLeft: 8, marginRight: -4 } }),
      })),
    },
    // Infobulles à 12 px au moins (11 px par défaut dans MUI)
    MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.75rem' } } },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiSkeleton: { defaultProps: { animation: false } },
    // Liens sans soulignement, comme dans une app
    MuiLink: { defaultProps: { underline: 'hover' } },
    // Sur téléphone, les fenêtres montent du bas de l'écran
    // Ouvrir une fenêtre ne retire pas non plus la barre de défilement (le contenu derrière ne se décale pas)
    MuiDialog: {
      defaultProps: { disableScrollLock: true },
      styleOverrides: {
        container: { [telephone]: { alignItems: 'flex-end' } },
        paper: { [telephone]: { margin: 0, width: '100%', maxWidth: '100%', maxHeight: 'calc(100% - 24px)', borderRadius: '24px 24px 0 0' } },
        paperFullScreen: { [telephone]: { height: 'auto', maxHeight: 'calc(100% - 24px)', borderRadius: '24px 24px 0 0' } },
      },
    },
    // Ouvrir un menu ou une liste ne doit pas retirer la barre de défilement (sinon la page se décale)
    MuiPopover: { defaultProps: { disableScrollLock: true } },
    // Colonne Magasin fixe au défilement horizontal : « colonne-fixe » (1re colonne) ou « deux-colonnes-fixes » (case à cocher + Magasin)
    MuiTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&.colonne-fixe tr > :first-of-type, &.deux-colonnes-fixes tr > :nth-of-type(-n+2)': {
            position: 'sticky', left: 0, zIndex: 2, backgroundColor: theme.palette.background.paper,
          },
          '&.colonne-fixe tr > :first-of-type': { boxShadow: `inset -1px 0 0 ${theme.palette.divider}` },
          '&.deux-colonnes-fixes tr > :first-of-type': { width: 52, minWidth: 52, maxWidth: 52 },
          '&.deux-colonnes-fixes tr > :nth-of-type(2)': { left: 52, boxShadow: `inset -1px 0 0 ${theme.palette.divider}` },
          '& thead tr > th': { zIndex: 3 },
        }),
      },
    },
    // Ligne des titres fixe au défilement vertical : le tableau défile dans sa carte, limitée à la hauteur de l'écran
    MuiTableContainer: {
      styleOverrides: {
        root: ({ theme }) => ({
          // Sous la barre du haut et les bandes collantes (onglets, filtres) : la ligne des titres reste visible
          maxHeight: 'calc(100dvh - 120px - var(--onglets, 0px) - var(--filtres, 0px))',
          // Une carte (Card, Paper) masque ce qui dépasse : le tableau doit pouvoir défiler dans sa hauteur
          '&.MuiTableContainer-root': { overflow: 'auto' },
          [theme.breakpoints.down('md')]: { maxHeight: 'calc(100dvh - 200px)' },
          '@media print': { maxHeight: 'none' },
        }),
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          position: 'sticky', top: 0, zIndex: 3,
          '& th': { backgroundColor: theme.palette.background.paper },
          '& tr:last-of-type > th': { boxShadow: `inset 0 -1px 0 ${theme.palette.divider}` },
        }),
      },
    },
    MuiMenu: { defaultProps: { disableScrollLock: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 999, minHeight: 40, paddingInline: 20 } },
    },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 16 } },
    },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 999 } } },
    MuiBottomNavigationAction: {
      styleOverrides: { label: { fontSize: '0.75rem', '&.Mui-selected': { fontSize: '0.75rem' } } },
    },
  },
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import { ThemeProvider } from '@mui/material/styles'
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import '@fontsource/lato/900.css'
import '@fontsource/alegreya/700.css'
import '@fontsource/alegreya/800.css'
import { theme } from './theme/theme'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import { adresseReseau, HOTE_PUBLIC } from './lib/redirection'

// L'adresse publique du pilotage renvoie vers l'app réseau (fusion, Joseph 03/11/2026) ; en local et en test, l'app reste
if (location.hostname === HOTE_PUBLIC) location.replace(adresseReseau(location.hash))
else createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <GlobalStyles styles={{ html: { scrollbarGutter: 'stable', overflowY: 'scroll' } }} />
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)

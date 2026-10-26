import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from './auth/AuthContext'
import { estDirecteur } from './auth/roles'
import { AppShell } from './layout/AppShell'
import { Connexion } from './pages/Connexion'
import { Magasin } from './pages/Magasin'
import { Magasins } from './pages/Magasins'
import { Parametres } from './pages/Parametres'

export default function App() {
  const { session, profil, chargement } = useAuth()
  if (chargement) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Chargement" /></Box>
  }
  if (!session || !profil) return <Connexion />
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Magasins />} />
          <Route path="/magasins/:nom" element={<Magasin />} />
          {estDirecteur(profil) && <Route path="/parametres" element={<Parametres />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}

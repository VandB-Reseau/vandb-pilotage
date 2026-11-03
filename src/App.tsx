import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from './auth/AuthContext'
import { estDirecteur, estEquipe, seulementParametres, voitParametres } from './auth/roles'
import { AppShell } from './layout/AppShell'
import { chargerAnnees, ecouterAnnees } from './data/annees'
import { oublier } from './data/pilotage'
import { Connexion } from './pages/Connexion'
import { Hypotheses } from './pages/Hypotheses'
import { Imports } from './pages/Imports'
import { Magasin } from './pages/Magasin'
import { Magasins } from './pages/Magasins'
import { Parametres } from './pages/Parametres'
import { Reseau } from './pages/Reseau'

export default function App() {
  const { session, profil, chargement } = useAuth()
  // Années du pilotage (0027) : lues avant d'ouvrir l'application ; quand le Directeur ouvre une campagne ou démarre un
  // suivi, l'application est redessinée et chaque page relit ses données avec les nouvelles années
  const [anneesLues, setAnneesLues] = useState<string | null>(null)
  const [, setVersion] = useState(0)
  const compte = session && profil ? `${session.user.id}|${profil.role}` : null
  useEffect(() => ecouterAnnees(() => { oublier(); setVersion((v) => v + 1) }), [])
  useEffect(() => {
    if (!compte) return
    let actif = true
    chargerAnnees().finally(() => actif && setAnneesLues(compte))
    return () => { actif = false }
  }, [compte])
  if (chargement || (compte && anneesLues !== compte)) {
    return <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Chargement" /></Box>
  }
  if (!session || !profil) return <Connexion />
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={seulementParametres(profil) ? <Navigate to="/parametres" replace /> : <Magasins />} />
          <Route path="/magasins/:nom/:partie?" element={<Magasin />} />
          {estEquipe(profil) && <Route path="/reseau" element={<Reseau />} />}
          {estDirecteur(profil) && <Route path="/hypotheses" element={<Hypotheses />} />}
          {estDirecteur(profil) && <Route path="/imports" element={<Imports />} />}
          {voitParametres(profil) && <Route path="/parametres" element={<Parametres />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}

import { useState, type FormEvent } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

export function Connexion() {
  const { connexion } = useAuth()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const valider = async (e: FormEvent) => {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const msg = await connexion(email.trim(), motDePasse)
    setEnvoi(false)
    if (msg) setErreur(msg)
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#f8bb09', position: 'relative', overflow: 'hidden' }}>
      <Box aria-hidden component="svg" viewBox="0 0 400 120" preserveAspectRatio="none" sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '32vh' }}>
        <path d="M0 70 C40 40 80 30 120 45 C150 55 170 20 215 22 C260 24 300 60 345 52 C370 48 390 40 400 42 L400 120 L0 120 Z" fill="#f7d802" />
        <path d="M0 95 C50 60 95 55 140 72 C175 85 205 70 240 74 C290 80 330 100 400 88 L400 120 L0 120 Z" fill="#3a8f8d" />
        <path d="M0 108 C60 92 120 96 170 104 C230 112 300 98 400 106 L400 120 L0 120 Z" fill="#307672" />
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, position: 'relative' }}>
        <Card component="form" onSubmit={valider} sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><Box sx={{ bgcolor: '#1d1d1b', px: 2, py: 1.5, borderRadius: 2 }}><Logo size={30} /></Box></Box>
          <Typography variant="h2" component="h1" align="center">Pilotage V and B</Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1, mb: 3 }}>Les mêmes identifiants que l’app du réseau.</Typography>
          {!supabaseConfigured && <Alert severity="warning" sx={{ mb: 2 }}>La connexion n’est pas encore configurée sur cette adresse.</Alert>}
          {erreur && <Alert severity="error" sx={{ mb: 2 }}>{erreur}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Mot de passe" type="password" autoComplete="current-password" required fullWidth value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} sx={{ mb: 3 }} />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={envoi} sx={{ minHeight: 48 }}>
            {envoi ? <CircularProgress size={22} color="inherit" /> : 'Se connecter'}
          </Button>
        </Card>
      </Box>
    </Box>
  )
}

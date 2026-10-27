import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { oublier } from '../data/pilotage'
import { supabase } from '../lib/supabase'
import type { Profil, Role } from './roles'

interface AuthState {
  session: Session | null
  profil: Profil | null
  chargement: boolean
  connexion: (email: string, motDePasse: string) => Promise<string | null>
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Rôle lu dans la base (fonction mon_acces de l'app réseau), jamais dans le seul jeton de connexion.
// Fonction injoignable : le compte n'a aucun accès plutôt qu'un accès par défaut.
async function lireRole(): Promise<Role> {
  try {
    const { data, error } = await supabase.rpc('mon_acces')
    const role = !error && data && typeof data === 'object' ? (data as { role?: string }).role : undefined
    return role === 'directeur' || role === 'rr' || role === 'coach' || role === 'franchise' ? role : 'aucun'
  } catch {
    return 'aucun'
  }
}

// « joseph.martin@… » → « Joseph »
function nomDepuisEmail(email: string): string {
  const prenom = email.split('@')[0].split(/[._-]/)[0]
  return prenom.charAt(0).toUpperCase() + prenom.slice(1)
}

function messageErreur(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.'
  if (m.includes('email not confirmed')) return 'Ton email n’est pas encore confirmé. Ouvre le lien reçu par email.'
  if (m.includes('fetch') || m.includes('network')) return 'Pas de connexion internet. Réessaie dans un instant.'
  return 'Connexion impossible pour le moment. Réessaie dans un instant.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<{ user: string; role: Role } | null>(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setChargement(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const utilisateur = session?.user.id ?? null
  useEffect(() => {
    if (!utilisateur) { setRole(null); return }
    let actif = true
    lireRole().then((r) => { if (actif) { setRole({ user: utilisateur, role: r }); setChargement(false) } })
    return () => { actif = false }
  }, [utilisateur])

  const pret = !utilisateur || role?.user === utilisateur
  const email = session?.user.email ?? ''
  const value: AuthState = {
    session,
    profil: session && pret && role ? { id: session.user.id, email, nom: nomDepuisEmail(email), role: role.role } : null,
    chargement: chargement || !pret,
    connexion: async (adresse, motDePasse) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: adresse, password: motDePasse })
        return error ? messageErreur(error.message) : null
      } catch (e) {
        return messageErreur(String(e))
      }
    },
    deconnexion: async () => { oublier(); await supabase.auth.signOut() },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}

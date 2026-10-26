import { createClient } from '@supabase/supabase-js'

// Même base que l'app réseau : mêmes comptes ; les données du pilotage sont rangées dans le schéma « pilotage ».
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://aipodcpbakywbrrilaud.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(url, anonKey || 'cle-absente', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const pilotage = () => supabase.schema('pilotage')

export const supabaseConfigured = anonKey.length > 0

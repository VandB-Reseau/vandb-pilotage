import { expect, type Page } from '@playwright/test'
import type { Hypotheses } from '../src/moteur/types'
import { MAGASINS, magasinFictif } from './donnees-fictives'

export const COMPTE = { email: 'joseph@vandb.test', motDePasse: 'bon-mot-de-passe' }

export interface MagasinSimule { magasin: string; statut: 'propose' | 'en_discussion' | 'valide' | null; hypotheses: Hypotheses | null; maj_le: string | null }
export interface OptionsSimulation {
  role?: 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'
  magasins?: MagasinSimule[]
  parametres?: Record<string, unknown> | null // null : pas encore enregistrés pour l'année
  panne?: boolean
}

export const magasinsParDefaut: MagasinSimule[] = [
  { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: '2026-10-20T09:30:00Z' },
  { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: { ...magasinFictif, familles: magasinFictif.familles.map((f) => ({ ...f, evolution: 0 })) }, maj_le: '2026-10-22T16:05:00Z' },
  { magasin: MAGASINS[2], statut: null, hypotheses: null, maj_le: null },
]

// Simule l'authentification et les fonctions de la base partagée : seul COMPTE est accepté
export async function simulerSupabase(page: Page, options: OptionsSimulation = {}) {
  await page.route('https://supabase.test/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const corps = req.postDataJSON() as { email: string; password: string }
      if (corps.email !== COMPTE.email || corps.password !== COMPTE.motDePasse) {
        return route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' } })
      }
      const maintenant = Math.floor(Date.now() / 1000)
      return route.fulfill({
        json: {
          access_token: 'jeton-test', token_type: 'bearer', expires_in: 3600, expires_at: maintenant + 3600, refresh_token: 'rafraichissement-test',
          user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: COMPTE.email, app_metadata: {}, user_metadata: {}, created_at: '2026-10-14T00:00:00Z' },
        },
      })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/rest/v1/rpc/mon_acces') return route.fulfill({ json: { role: options.role ?? 'directeur' } })
    if (options.panne) return route.fulfill({ status: 500, json: { message: 'indisponible' } })
    const schema = req.headers()['accept-profile'] ?? req.headers()['content-profile']
    if (schema !== 'pilotage') return route.fulfill({ status: 404, json: { message: 'schéma inattendu' } })
    if (url.pathname === '/rest/v1/rpc/magasins_du_compte') return route.fulfill({ json: options.magasins ?? magasinsParDefaut })
    if (url.pathname === '/rest/v1/parametres_reseau') {
      const lignes = options.parametres === null ? [] : [{ valeur: options.parametres ?? { tauxRedevance: 0.02, tauxPublicite: 0.01 } }]
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (objet) return lignes.length ? route.fulfill({ json: lignes[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } })
      return route.fulfill({ json: lignes })
    }
    return route.fulfill({ status: 404, json: { message: 'inconnu' } })
  })
}

export async function seConnecter(page: Page, options: OptionsSimulation = {}) {
  await simulerSupabase(page, options)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

// Textes visibles sous 12 px (le logo est une image)
export async function textesTropPetits(page: Page, min = 12): Promise<string[]> {
  return page.evaluate((min) => {
    const fautifs: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      const t = n.textContent?.trim()
      const el = n.parentElement
      if (!t || !el || el.closest('[role=img]')) continue
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue
      if (parseFloat(s.fontSize) < min) fautifs.push(`${t} (${s.fontSize})`)
    }
    return fautifs
  }, min)
}

// Liens et boutons visibles de moins de 48 px de haut
export async function zonesTropPetites(page: Page, min = 48): Promise<string[]> {
  return page.evaluate((min) => {
    return [...document.querySelectorAll<HTMLElement>('a, button, [role=button], input')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < min && getComputedStyle(el).visibility !== 'hidden' })
      .map((el) => `${el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName} (${Math.round(el.getBoundingClientRect().height)} px)`)
  }, min)
}

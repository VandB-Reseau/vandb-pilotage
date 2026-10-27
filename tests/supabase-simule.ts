import { expect, type Page } from '@playwright/test'
import type { Hypotheses } from '../src/moteur/types'
import { MAGASINS, magasinFictif } from './donnees-fictives'

export const COMPTE = { email: 'joseph@vandb.test', motDePasse: 'bon-mot-de-passe' }

export interface MagasinSimule {
  magasin: string
  statut: 'propose' | 'en_discussion' | 'valide' | null
  hypotheses: Hypotheses | null
  maj_le: string | null
  base?: Hypotheses | null
  ajustements?: Record<string, unknown>
  groupe_id?: number | null
}
export interface VenteSimulee { store_name: string; mois: string; univers: string; famille: string; ca_ht: number; ca_ttc: number | null; marge_ht: number | null }
export interface TicketsSimules { store_name: string; mois: string; univers: string; tickets: number }
export interface PersonneSimulee { id: number; store_name: string; poste: string; categorie: string; heures_hebdo: number; brut_mensuel: number; primes: { mois: number; montant: number }[]; entree: string | null; sortie: string | null }
export interface FraisSimule { store_name: string; code: string; libelle: string; rubrique: string; annuel: number | null; taux_ca: number | null }
export interface GroupeSimule { id: number; nom: string; cibles: Record<string, unknown> | null }
export interface OptionsSimulation {
  role?: 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'
  magasins?: MagasinSimule[]
  reseau?: Record<string, unknown> | null
  groupes?: GroupeSimule[]
  parametres?: Record<string, unknown> | null // null : pas encore enregistrés pour l'année
  reel?: VenteSimulee[]
  tickets?: TicketsSimules[]
  codes?: { code: string; store_name: string }[]
  equipe?: PersonneSimulee[]
  frais?: FraisSimule[]
  panne?: boolean
  panneEcriture?: boolean
}

// Écritures reçues par la base simulée, pour les vérifier dans les tests
export interface Ecriture { table: string; methode: string; corps: unknown; filtre: string }

export const magasinsParDefaut: MagasinSimule[] = [
  { magasin: MAGASINS[0], statut: 'valide', hypotheses: magasinFictif, maj_le: '2026-10-20T09:30:00Z' },
  { magasin: MAGASINS[1], statut: 'en_discussion', hypotheses: { ...magasinFictif, familles: magasinFictif.familles.map((f) => ({ ...f, evolution: 0 })) }, maj_le: '2026-10-22T16:05:00Z' },
  { magasin: MAGASINS[2], statut: null, hypotheses: null, maj_le: null },
]

// Simule l'authentification et les fonctions de la base partagée : seul COMPTE est accepté
export async function simulerSupabase(page: Page, options: OptionsSimulation = {}): Promise<Ecriture[]> {
  const ecritures: Ecriture[] = []
  // État de la base simulée : les écritures sont relues au chargement suivant
  const magasins = structuredClone(options.magasins ?? magasinsParDefaut).map((m) => ({ ajustements: {}, base: null, groupe_id: null, ...m }))
  const groupes = structuredClone(options.groupes ?? [])
  let reseau = options.reseau ?? null
  const reel = { reel_mensuel: structuredClone(options.reel ?? []) as (VenteSimulee | TicketsSimules)[], reel_tickets: structuredClone(options.tickets ?? []) as (VenteSimulee | TicketsSimules)[] }
  let codes = structuredClone(options.codes ?? [])
  let equipe = structuredClone(options.equipe ?? [])
  let frais = structuredClone(options.frais ?? [])
  let parametres = options.parametres === null ? null : options.parametres ?? { tauxRedevance: 0.02, tauxPublicite: 0.01 }
  // Filtres PostgREST utilisés par l'app : eq, gte, lte, in
  const filtrer = <T extends Record<string, unknown>>(lignes: T[], params: URLSearchParams) => lignes.filter((l) => [...params.entries()].every(([k, v]) => {
    if (k === 'select' || k === 'order') return true
    const [op, ...reste] = v.split('.')
    const x = reste.join('.'), y = String(l[k])
    if (op === 'in') return x.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')).includes(y)
    return op === 'eq' ? y === x : op === 'gte' ? y >= x : op === 'lte' ? y <= x : true
  }))
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
    if (url.pathname === '/rest/v1/rpc/budgets_du_compte') return route.fulfill({ json: { magasins, reseau, groupes } })
    const table = url.pathname.replace('/rest/v1/', '')
    if (req.method() !== 'GET') {
      const corps = req.postDataJSON()
      const filtre = url.search
      ecritures.push({ table, methode: req.method(), corps, filtre })
      if (options.panneEcriture) return route.fulfill({ status: 500, json: { message: 'indisponible' } })
      const nom = decodeURIComponent(url.searchParams.get('store_name')?.replace(/^eq\./, '') ?? (corps as { store_name?: string })?.store_name ?? '')
      const m = magasins.find((x) => x.magasin === nom)
      if (table === 'budgets' && m) {
        const c = corps as Record<string, unknown>
        Object.assign(m, { ...('base' in c ? { base: c.base } : {}), ...('ajustements' in c ? { ajustements: c.ajustements } : {}), ...('hypotheses' in c ? { hypotheses: c.hypotheses } : {}) })
        m.statut = (c.statut as MagasinSimule['statut']) ?? (options.role === 'franchise' ? 'en_discussion' : m.statut)
        m.maj_le = '2026-10-26T22:00:00Z'
      }
      if (table === 'cibles_reseau') reseau = (corps as { valeur: Record<string, unknown> }).valeur
      if (table === 'cibles_groupe') {
        const c = corps as { groupe_id: number; valeur: Record<string, unknown> }
        const g = groupes.find((x) => x.id === c.groupe_id)
        if (g) g.cibles = c.valeur
      }
      if (table === 'groupes' && req.method() === 'POST') {
        const id = Math.max(0, ...groupes.map((g) => g.id)) + 1
        groupes.push({ id, nom: (corps as { nom: string }).nom, cibles: null })
        return route.fulfill({ status: 201, json: { id } })
      }
      if (table === 'groupes' && req.method() === 'DELETE') {
        const id = Number(url.searchParams.get('id')?.replace(/^eq\./, ''))
        groupes.splice(groupes.findIndex((g) => g.id === id), 1)
        for (const x of magasins) if (x.groupe_id === id) x.groupe_id = null
      }
      if (table === 'rpc/remplacer_reel') {
        const c = corps as { p_ventes: VenteSimulee[]; p_tickets: TicketsSimules[] }
        for (const [t, lignes] of [['reel_mensuel', c.p_ventes], ['reel_tickets', c.p_tickets]] as const) {
          const vides = new Set(lignes.map((l) => `${l.store_name}|${l.mois}`))
          reel[t] = [...reel[t].filter((l) => !vides.has(`${l.store_name}|${l.mois}`)), ...lignes]
        }
        return route.fulfill({ json: c.p_ventes.length })
      }
      if ((table === 'reel_mensuel' || table === 'reel_tickets') && req.method() === 'DELETE') {
        const garder = new Set(filtrer(reel[table], url.searchParams))
        reel[table] = reel[table].filter((l) => !garder.has(l))
      }
      if (table === 'codes_caisse') {
        if (req.method() === 'DELETE') codes = codes.filter((c) => c.code !== url.searchParams.get('code')?.replace(/^eq\./, ''))
        else { const c = corps as { code: string; store_name: string }; codes = [...codes.filter((x) => x.code !== c.code), c] }
      }
      if (table === 'equipe') {
        const id = Number(url.searchParams.get('id')?.replace(/^eq\./, ''))
        if (req.method() === 'DELETE') equipe = equipe.filter((p) => p.id !== id)
        else if (req.method() === 'PATCH') equipe = equipe.map((p) => (p.id === id ? { ...p, ...(corps as object) } : p))
        else equipe.push({ ...(corps as PersonneSimulee), id: Math.max(0, ...equipe.map((p) => p.id)) + 1 })
      }
      if (table === 'frais') {
        if (req.method() === 'DELETE') { const retirer = new Set(filtrer(frais, url.searchParams)); frais = frais.filter((l) => !retirer.has(l)) }
        else for (const l of ([] as FraisSimule[]).concat(corps as FraisSimule)) frais = [...frais.filter((x) => !(x.store_name === l.store_name && x.code === l.code)), l]
      }
      if (table === 'parametres_reseau') parametres = (corps as { valeur: Record<string, unknown> }).valeur
      if (table === 'groupe_magasins' && m) m.groupe_id = req.method() === 'DELETE' ? null : (corps as { groupe_id: number }).groupe_id
      return route.fulfill({ status: 204, body: '' })
    }
    if (table === 'reel_mensuel' || table === 'reel_tickets') return route.fulfill({ json: filtrer(reel[table], url.searchParams) })
    if (table === 'equipe') return route.fulfill({ json: equipe })
    if (table === 'frais') return route.fulfill({ json: frais })
    if (table === 'codes_caisse') return route.fulfill({ json: [...codes].sort((a, b) => a.code.localeCompare(b.code)) })
    if (url.pathname === '/rest/v1/parametres_reseau') {
      const lignes = parametres === null ? [] : [{ valeur: parametres }]
      const objet = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (objet) return lignes.length ? route.fulfill({ json: lignes[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } })
      return route.fulfill({ json: lignes })
    }
    return route.fulfill({ status: 404, json: { message: 'inconnu' } })
  })
  return ecritures
}

export async function seConnecter(page: Page, options: OptionsSimulation = {}): Promise<Ecriture[]> {
  const ecritures = await simulerSupabase(page, options)
  await page.goto('./')
  await page.getByLabel('Email').fill(COMPTE.email)
  await page.getByLabel('Mot de passe').fill(COMPTE.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  return ecritures
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

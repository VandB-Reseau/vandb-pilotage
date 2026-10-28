import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ReplayOutlined from '@mui/icons-material/ReplayOutlined'
import { AlertesMagasins, texteAlerte, typeAlerteLibelle } from './AlertesMagasins'
import { roleLibelle } from '../auth/roles'
import {
  changerStatutAction, chargerActions, chargerAlertes, chargerMesures, creerAction, retirerAction,
  type Action, type Responsable, type StatutAction,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartPts, ecartTaux, montant, MOIS_LONGS } from '../lib/format'
import { universLibelle } from '../moteur/types'
import { effetAction, mesureDeAlerte, type Alerte, type Mesure, type TypeAction, type TypeAlerte } from '../moteur/alertes'

const RESPONSABLES: Responsable[] = ['franchise', 'coach', 'rr', 'directeur']
export const typeActionLibelle: Record<TypeAction, string> = { ...typeAlerteLibelle, autre: 'Autre' }
const champ = { '& .MuiInputBase-root': { minHeight: 48 }, '& .MuiSelect-nativeInput': { height: 48 } }
const jour = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR')
const aujourdhuiISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function texteMesure(type: TypeAlerte, m: Mesure): string {
  const fin = m.mois ? ` à fin ${MOIS_LONGS[m.mois - 1]}` : ''
  switch (type) {
    case 'ca': return `${ecartTaux(m.valeur)} face au budget${fin}`
    case 'marge': return `${ecartPts(m.valeur)} sur l’an dernier${fin}`
    case 'tickets': case 'panier': return `${ecartTaux(m.valeur)} sur l’an dernier, 3 mois${fin}`
    case 'reel': return m.valeur === 0 ? 'Réel à jour' : m.valeur === 1 ? '1 mois manquant' : `${m.valeur} mois manquants`
    case 'tresorerie': return `${montant(m.valeur)}${fin}`
  }
}

// En tête de la synthèse d'un magasin : ses alertes, et le plan d'action qui y répond
export function AlertesEtActions({ magasin, equipe }: { magasin: string; equipe: boolean }) {
  const alertes = useChargement(() => chargerAlertes(), [])
  // Sans la table des actions (migration pas encore passée), pas de plan : les alertes restent
  const plan = useChargement(() => Promise.all([chargerActions(), chargerMesures()]).catch(() => null), [])
  const [depuis, setDepuis] = useState<Alerte | 'autre' | null>(null)
  const duMagasin = alertes.donnees?.filter((a) => a.magasin === magasin) ?? []
  const actions = plan.donnees?.[0].filter((a) => a.magasin === magasin)
  return (
    <>
      {duMagasin.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <AlertesMagasins alertes={duMagasin} unMagasin siVide={false} actions={actions ?? []} agir={equipe && plan.donnees ? setDepuis : undefined} />
        </Box>
      )}
      {plan.donnees && actions && (
        <PlanAction magasin={magasin} equipe={equipe} alertes={duMagasin} actions={actions} mesures={plan.donnees[1][magasin] ?? {}}
          recharger={plan.recharger} depuis={depuis} setDepuis={setDepuis} />
      )}
    </>
  )
}

function PlanAction({ magasin, equipe, alertes, actions, mesures, recharger, depuis, setDepuis }: {
  magasin: string
  equipe: boolean
  alertes: Alerte[]
  actions: Action[]
  mesures: Partial<Record<TypeAlerte, Mesure>>
  recharger: () => void
  depuis: Alerte | 'autre' | null
  setDepuis: (a: Alerte | 'autre' | null) => void
}) {
  const [voirFaites, setVoirFaites] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [probleme, setProbleme] = useState<string | null>(null)

  const enCours = actions.filter((a) => a.statut === 'a_faire').sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'))
  const closes = actions.filter((a) => a.statut !== 'a_faire').reverse()
  if (!equipe && !actions.length) return null

  const agir = async (f: () => Promise<void>) => {
    setOccupe(true)
    setProbleme(null)
    try { await f(); recharger() } catch { setProbleme('La modification n’a pas abouti. Vérifie ta connexion, puis réessaie.') } finally { setOccupe(false) }
  }
  const ligne = (a: Action) => {
    const actuelle = a.type !== 'autre' ? mesures[a.type] : undefined
    const effet = a.type !== 'autre' && a.depart && actuelle ? effetAction(a.type, a.depart.valeur, actuelle.valeur) : null
    const enRetard = a.statut === 'a_faire' && a.echeance !== null && a.echeance < aujourdhuiISO()
    return (
      <Box component="li" key={a.id} sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere', ...(a.statut !== 'a_faire' ? { color: 'text.secondary' } : {}) }}>{a.intitule}</Typography>
          <Typography variant="body2" color="text.secondary">
            {typeActionLibelle[a.type]} · {roleLibelle[a.responsable]}
            {a.echeance && <> · <Box component="span" sx={enRetard ? { color: 'error.main', fontWeight: 600 } : undefined}>{enRetard ? 'en retard, prévue le' : 'pour le'} {jour(a.echeance)}</Box></>}
            {a.statut === 'faite' && a.faiteLe && <> · faite le {new Date(a.faiteLe).toLocaleDateString('fr-FR')}</>}
            {a.statut === 'abandonnee' && <> · abandonnée</>}
          </Typography>
          {a.type !== 'autre' && a.depart && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Au départ : {texteMesure(a.type, a.depart)}
              {actuelle && <> · aujourd’hui : <Box component="span" sx={{ fontWeight: 600, color: effet?.favorable === true ? 'success.main' : effet?.favorable === false ? 'error.main' : undefined }}>{texteMesure(a.type, actuelle)}</Box></>}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {a.statut === 'a_faire' ? (
            <>
              <Button variant="outlined" startIcon={<CheckOutlined />} disabled={occupe} onClick={() => void agir(() => changerStatutAction(a.id, 'faite'))} sx={{ minHeight: 48 }} aria-label={`Faite : ${a.intitule}`}>Faite</Button>
              <Button disabled={occupe} onClick={() => void agir(() => changerStatutAction(a.id, 'abandonnee'))} sx={{ minHeight: 48 }} aria-label={`Abandonner : ${a.intitule}`}>Abandonner</Button>
            </>
          ) : (
            <Button startIcon={<ReplayOutlined />} disabled={occupe} onClick={() => void agir(() => changerStatutAction(a.id, 'a_faire' as StatutAction))} sx={{ minHeight: 48 }} aria-label={`Rouvrir : ${a.intitule}`}>Rouvrir</Button>
          )}
          {equipe && (
            <IconButton disabled={occupe} onClick={() => void agir(() => retirerAction(a.id))} sx={{ width: 48, height: 48 }} aria-label={`Retirer : ${a.intitule}`}><DeleteOutlined /></IconButton>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Card component="section" aria-label="Plan d’action" id="plan-action" sx={{ mb: 3 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Plan d’action</Typography>
        {equipe && depuis === null && (
          <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setDepuis('autre')} sx={{ minHeight: 48 }}>Ajouter une action</Button>
        )}
      </Box>
      {probleme && <Box sx={{ px: 2.5, pb: 1 }}><Alert severity="error">{probleme}</Alert></Box>}
      {equipe && depuis !== null && (
        <NouvelleActionForm
          key={depuis === 'autre' ? 'autre' : `${depuis.type}-${texteAlerte(depuis)}`}
          magasin={magasin} alertes={alertes} depuis={depuis} occupe={occupe}
          valider={(a) => void agir(async () => { await creerAction(a); setDepuis(null) })}
          annuler={() => setDepuis(null)}
        />
      )}
      {enCours.length === 0 && depuis === null && (
        <Typography color="text.secondary" sx={{ px: 2.5, pb: 2 }}>Aucune action en cours.</Typography>
      )}
      {enCours.length > 0 && <Stack component="ul" aria-label="Actions en cours" sx={{ listStyle: 'none', m: 0, p: 0 }}>{enCours.map(ligne)}</Stack>}
      {closes.length > 0 && (
        <>
          <Box sx={{ px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setVoirFaites((v) => !v)} aria-expanded={voirFaites} sx={{ minHeight: 48 }}>
              {voirFaites ? 'Masquer les actions closes' : `Actions closes (${closes.length})`}
            </Button>
          </Box>
          {voirFaites && <Stack component="ul" aria-label="Actions closes" sx={{ listStyle: 'none', m: 0, p: 0 }}>{closes.map(ligne)}</Stack>}
        </>
      )}
    </Card>
  )
}

function NouvelleActionForm({ magasin, alertes, depuis, occupe, valider, annuler }: {
  magasin: string
  alertes: Alerte[]
  depuis: Alerte | 'autre'
  occupe: boolean
  valider: (a: Parameters<typeof creerAction>[0]) => void
  annuler: () => void
}) {
  const [choix, setChoix] = useState(depuis === 'autre' ? -1 : Math.max(0, alertes.findIndex((a) => texteAlerte(a) === texteAlerte(depuis))))
  // Tickets et panier (lot 28) : l'action part du levier commercial, à compléter
  const [intitule, setIntitule] = useState(depuis !== 'autre' && (depuis.type === 'tickets' || depuis.type === 'panier')
    ? `${depuis.type === 'tickets' ? 'Fréquentation' : 'Vente additionnelle'} ${universLibelle[depuis.univers]} : ` : '')
  const [responsable, setResponsable] = useState<Responsable>('franchise')
  const [echeance, setEcheance] = useState('')
  const alerte = choix >= 0 ? alertes[choix] : null
  return (
    <Box component="form" aria-label="Nouvelle action" sx={{ px: 2.5, pb: 2 }} onSubmit={(e) => {
      e.preventDefault()
      if (!intitule.trim()) return
      valider({
        magasin, type: alerte?.type ?? 'autre', intitule, responsable, echeance: echeance || null,
        annee: new Date().getFullYear(), depart: alerte ? mesureDeAlerte(alerte) : null,
      })
    }}>
      <Stack spacing={1.5}>
        <TextField select size="small" label="Répond à" value={choix} onChange={(e) => setChoix(Number(e.target.value))} sx={{ maxWidth: 520, ...champ }}>
          {alertes.map((a, i) => <MenuItem key={i} value={i} sx={{ minHeight: 48 }}>{texteAlerte(a)}</MenuItem>)}
          <MenuItem value={-1} sx={{ minHeight: 48 }}>Autre sujet</MenuItem>
        </TextField>
        <TextField label="Action" value={intitule} onChange={(e) => setIntitule(e.target.value.slice(0, 300))} required multiline maxRows={4} sx={{ maxWidth: 720 }} />
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField select size="small" label="Qui" value={responsable} onChange={(e) => setResponsable(e.target.value as Responsable)} sx={{ width: 240, ...champ }}>
            {RESPONSABLES.map((r) => <MenuItem key={r} value={r} sx={{ minHeight: 48 }}>{roleLibelle[r]}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Pour le" value={echeance} onChange={(e) => setEcheance(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 200, ...champ }} />
        </Stack>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button type="submit" variant="contained" disabled={occupe || !intitule.trim()} sx={{ minHeight: 48 }}>Ajouter au plan</Button>
          <Button onClick={annuler} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
        </Box>
      </Stack>
    </Box>
  )
}

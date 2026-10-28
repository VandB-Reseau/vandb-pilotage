import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { anneeBudget, chargerBudgets } from '../data/pilotage'
import { lienMagasin } from '../lib/format'
import { useGarde } from './GardeSaisie'

// Recherche d'un magasin depuis n'importe quel écran (lot 25) : deux lettres suffisent, les derniers magasins consultés
// en tête de liste, Ctrl+K (⌘K sur Mac) sur PC. Sur téléphone, une icône ouvre la recherche en plein écran.
const CLE_RECENTS = 'pilotage.magasins-recents'
const MAX_RECENTS = 5
const RECENTS = 'Consultés récemment'

function lireRecents(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_RECENTS) ?? '[]') as unknown
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
function noterRecent(nom: string): string[] {
  const l = [nom, ...lireRecents().filter((x) => x !== nom)].slice(0, MAX_RECENTS)
  try { localStorage.setItem(CLE_RECENTS, JSON.stringify(l)) } catch { /* navigation privée : pas de mémoire, rien de grave */ }
  return l
}

// « saint aubin », « St-Aubin » ou « aubin des pres » retrouvent « Saint-Aubin-des-Prés »
const simple = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim()
const filtre = createFilterOptions<string>({ stringify: simple, matchFrom: 'any', trim: true })

export function RechercheMagasin({ telephone }: { telephone: boolean }) {
  const [magasins, setMagasins] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>(lireRecents)
  const [ouvert, setOuvert] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const garde = useGarde()
  const { pathname } = useLocation()

  useEffect(() => {
    let actif = true
    chargerBudgets(anneeBudget()).then((d) => actif && setMagasins(d.magasins.map((m) => m.magasin).sort((a, b) => a.localeCompare(b, 'fr'))), () => {})
    return () => { actif = false }
  }, [])
  // Chaque fiche ouverte, par la recherche ou ailleurs, entre dans les magasins récents
  useEffect(() => {
    const m = /^\/magasins\/([^/]+)/.exec(pathname)
    if (m) setRecents(noterRecent(decodeURIComponent(m[1])))
  }, [pathname])
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (telephone) setOuvert(true)
        else champ.current?.focus()
      }
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [telephone])

  const options = useMemo(() => {
    const r = recents.filter((x) => magasins.includes(x))
    return [...r, ...magasins.filter((x) => !r.includes(x))]
  }, [magasins, recents])
  if (magasins.length <= 1) return null

  const ouvrir = (nom: string | null) => {
    if (!nom) return
    setOuvert(false)
    champ.current?.blur()
    garde(() => navigate(lienMagasin(nom), { state: { liste: magasins } }))
  }
  const recherche = (enDialogue: boolean) => (
    <Autocomplete
      options={options} value={null} blurOnSelect clearOnBlur autoHighlight openOnFocus={enDialogue}
      groupBy={(o) => (recents.includes(o) ? RECENTS : 'Tous les magasins')}
      filterOptions={(o, s) => filtre(o, { ...s, inputValue: simple(s.inputValue) })}
      onChange={(_, m) => ouvrir(m)}
      noOptionsText="Aucun magasin ne correspond" openText="Ouvrir la liste" closeText="Fermer la liste"
      popupIcon={null} forcePopupIcon={false}
      slotProps={{ listbox: { sx: { '& .MuiAutocomplete-option': { minHeight: 48 } } }, popper: { sx: { zIndex: 1500 } } }}
      sx={{ width: enDialogue ? '100%' : 360 }}
      renderInput={(p) => (
        <TextField
          {...p} inputRef={champ} autoFocus={enDialogue} placeholder={enDialogue ? 'Nom du magasin' : 'Rechercher un magasin (Ctrl+K)'}
          slotProps={{
            ...p.slotProps,
            htmlInput: { ...p.slotProps.htmlInput, 'aria-label': 'Rechercher un magasin' },
            input: { ...p.slotProps.input, startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> },
          }}
          sx={{
            '& .MuiInputBase-root': { py: '0 !important', bgcolor: '#ffffff', borderRadius: 2 },
            '& input': { height: enDialogue ? 48 : 40, boxSizing: 'border-box' },
          }}
        />
      )}
    />
  )

  if (!telephone) return recherche(false)
  return (
    <>
      <IconButton color="inherit" aria-label="Rechercher un magasin" onClick={() => setOuvert(true)} sx={{ width: 48, height: 48 }}>
        <SearchOutlined />
      </IconButton>
      <Dialog open={ouvert} onClose={() => setOuvert(false)} fullScreen aria-labelledby="recherche-titre">
        <DialogTitle id="recherche-titre" sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
          <span style={{ flex: 1 }}>Rechercher un magasin</span>
          <IconButton aria-label="Fermer la recherche" onClick={() => setOuvert(false)} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>{recherche(true)}</DialogContent>
      </Dialog>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { magasinDeChemin } from '../lib/navigation'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined'
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
// Partie affichée, lue dans l'adresse au moment du choix (la fiche a pu changer de partie depuis l'ouverture du menu)
const partieActuelle = () => magasinDeChemin(window.location.hash.replace(/^#/, '').split('?')[0])?.partie ?? null
const filtre = createFilterOptions<string>({ stringify: simple, matchFrom: 'any', trim: true })

export function RechercheMagasin({ telephone }: { telephone: boolean }) {
  const [magasins, setMagasins] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>(lireRecents)
  const [ouvert, setOuvert] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const garde = useGarde()
  const { pathname } = useLocation()
  // Lot 36 : d'un magasin à l'autre, on reste sur la même partie (même espace)
  const partieOuverte = magasinDeChemin(pathname)?.partie ?? null

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
    garde(() => navigate(lienMagasin(nom, partieActuelle() ?? partieOuverte ?? undefined), { state: { liste: magasins } }))
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
      sx={{ width: '100%', maxWidth: enDialogue ? undefined : 560 }}
      renderInput={(p) => (
        <TextField
          {...p} inputRef={champ} autoFocus={enDialogue} placeholder={enDialogue ? 'Nom du magasin' : 'Rechercher un magasin (Ctrl+K)'}
          slotProps={{
            ...p.slotProps,
            htmlInput: { ...p.slotProps.htmlInput, 'aria-label': 'Rechercher un magasin' },
            input: { ...p.slotProps.input, startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> },
          }}
          // Joseph (03/11/2026) : dans la barre noire, la recherche en pilule de 44 px de l'app réseau
          sx={enDialogue ? {
            '& .MuiInputBase-root': { py: '0 !important', bgcolor: '#ffffff', borderRadius: 2 },
            '& input': { height: 48, boxSizing: 'border-box' },
          } : {
            '& .MuiInputBase-root': { py: '0 !important', px: 2, height: 44, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 999, color: '#ffffff', fontSize: '0.875rem' },
            '& .MuiOutlinedInput-notchedOutline': { border: 0 },
            '& .MuiInputAdornment-root, & .MuiSvgIcon-root': { color: '#ffffff' },
            '& input': { height: 44, boxSizing: 'border-box' },
            '& input::placeholder': { color: 'rgba(255,255,255,0.78)', opacity: 1 },
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

// Lot 37 (Joseph, 02/11/2026) : le menu de gauche ne montre que le magasin ouvert ; son nom est un sélecteur qui ouvre la
// liste de tes magasins, avec recherche, sans quitter la page affichée (même partie pour le nouveau magasin).
// Lot 42 (Joseph, 02/11/2026) : le sélecteur passe dans la barre du haut (« sombre ») ; le menu de gauche ne montre plus le magasin.
export function SelecteurMagasin({ magasin, sombre = false }: { magasin: string; sombre?: boolean }) {
  const [magasins, setMagasins] = useState<string[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [texte, setTexte] = useState('')
  const navigate = useNavigate()
  const garde = useGarde()
  useEffect(() => {
    let actif = true
    chargerBudgets(anneeBudget()).then((d) => actif && setMagasins(d.magasins.map((m) => m.magasin).sort((a, b) => a.localeCompare(b, 'fr'))), () => {})
    return () => { actif = false }
  }, [])
  const recents = lireRecents().filter((x) => magasins.includes(x) && x !== magasin)
  const options = [...recents, ...magasins.filter((x) => !recents.includes(x) && x !== magasin)]
  const visibles = options.filter((m) => simple(m).includes(simple(texte)))
  const titre = <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>{sombre ? magasin : 'Changer de magasin'}</Box>
  if (magasins.length <= 1) {
    if (!sombre) return null
    return <Box aria-label={`Magasin ouvert : ${magasin}`} sx={{ display: 'flex', minWidth: 0, maxWidth: { xs: 160, md: 280 }, px: 1, py: 1, fontWeight: 700, fontSize: '0.9375rem' }}>{titre}</Box>
  }
  const choisir = (nom: string | null) => {
    if (!nom) return
    setOuvert(false)
    setTexte('')
    garde(() => navigate(lienMagasin(nom, partieActuelle() ?? undefined), { state: { liste: magasins } }))
  }
  return (
    <>
      <Button onClick={() => { setTexte(''); setOuvert(true) }} aria-label={`Changer de magasin (magasin ouvert : ${magasin})`} endIcon={<UnfoldMoreOutlined />}
        sx={sombre
          ? { minWidth: 0, maxWidth: { xs: 170, md: 280 }, minHeight: 48, px: 1.5, color: '#ffffff', fontWeight: 700, fontSize: '0.9375rem', textTransform: 'none', justifyContent: 'space-between', border: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 2, '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.08)' } }
          : { minWidth: 0, maxWidth: { xs: 220, md: 280 }, minHeight: 48, px: 1.5, color: 'text.primary', fontWeight: 600, fontSize: '0.875rem', textTransform: 'none', justifyContent: 'space-between', border: 1, borderColor: 'divider', borderRadius: 2 }}>
        {titre}
      </Button>
      <Dialog open={ouvert} onClose={() => setOuvert(false)} fullWidth maxWidth="xs" aria-labelledby="selecteur-titre" slotProps={{ paper: { sx: { alignSelf: 'flex-start', mt: 10 } } }}>
        <DialogTitle id="selecteur-titre" sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
          <span style={{ flex: 1 }}>Changer de magasin</span>
          <IconButton aria-label="Fermer" onClick={() => setOuvert(false)} sx={{ width: 48, height: 48 }}><CloseOutlined /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important', pb: 3 }}>
          <TextField autoFocus fullWidth placeholder="Nom du magasin" value={texte} onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && visibles[0]) choisir(visibles[0]) }}
            slotProps={{ htmlInput: { 'aria-label': 'Nom du magasin' }, input: { startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> } }}
            sx={{ '& input': { height: 48, boxSizing: 'border-box' } }} />
          <List aria-label="Mes magasins" sx={{ maxHeight: '50vh', overflowY: 'auto', mt: 1 }}>
            {visibles.length === 0 && <ListItem><ListItemText primary="Aucun magasin ne correspond" /></ListItem>}
            {visibles.map((m) => (
              <ListItemButton key={m} onClick={() => choisir(m)} sx={{ minHeight: 48, borderRadius: 1 }}>
                <ListItemText primary={m} secondary={recents.includes(m) ? RECENTS : undefined} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  )
}

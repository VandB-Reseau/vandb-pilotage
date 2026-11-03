import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'

// Saisies non enregistrées : quitter l'onglet, la page ou l'app demande confirmation au lieu de tout perdre
// Lot 43 : une saisie « forte » (qui ne vit que dans son écran) est gardée même entre deux étapes du budget, où les
// ajustements en cours restent en mémoire
interface Garde { signaler: (id: string, modifie: boolean, fort?: boolean) => void; demander: (action: () => void, entreEtapes?: boolean) => void }
const Contexte = createContext<Garde>({ signaler: () => {}, demander: (a) => a() })

export function GardeSaisie({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const enCours = useRef(new Set<string>())
  const forts = useRef(new Set<string>())
  const [attente, setAttente] = useState<(() => void) | null>(null)

  const signaler = useCallback((id: string, modifie: boolean, fort = false) => {
    if (modifie) enCours.current.add(id)
    else enCours.current.delete(id)
    if (modifie && fort) forts.current.add(id)
    else forts.current.delete(id)
  }, [])
  const demander = useCallback((action: () => void, entreEtapes = false) => {
    if ((entreEtapes ? forts : enCours).current.size === 0) action()
    else setAttente(() => action)
  }, [])

  useEffect(() => {
    // Fermeture de l'onglet du navigateur
    const avantDepart = (e: BeforeUnloadEvent) => { if (enCours.current.size) e.preventDefault() }
    // Liens internes (menu, retour, magasin suivant) : interceptés avant la navigation
    const clic = (e: MouseEvent) => {
      if (!enCours.current.size || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      const lien = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#/"]')
      // Lot 36 : lien marqué « sans garde » (étape suivante du budget) : les ajustements en cours restent en mémoire
      if (!lien || (lien.hasAttribute('data-sans-garde') && !forts.current.size)) return
      e.preventDefault()
      const cible = lien.getAttribute('href')!.slice(1)
      setAttente(() => () => navigate(cible))
    }
    window.addEventListener('beforeunload', avantDepart)
    document.addEventListener('click', clic, true)
    return () => { window.removeEventListener('beforeunload', avantDepart); document.removeEventListener('click', clic, true) }
  }, [navigate])

  const quitter = () => {
    const action = attente
    enCours.current.clear()
    forts.current.clear()
    setAttente(null)
    action?.()
  }

  return (
    <Contexte.Provider value={{ signaler, demander }}>
      {children}
      <Dialog open={!!attente} onClose={() => setAttente(null)} aria-labelledby="garde-titre">
        <DialogTitle id="garde-titre">Modifications non enregistrées</DialogTitle>
        <DialogContent>
          <Typography>Si tu quittes maintenant, ta saisie sera perdue.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={quitter} color="error" sx={{ minHeight: 48 }}>Quitter sans enregistrer</Button>
          <Button variant="contained" onClick={() => setAttente(null)} autoFocus sx={{ minHeight: 48 }}>Rester</Button>
        </DialogActions>
      </Dialog>
    </Contexte.Provider>
  )
}

// À appeler par un écran de saisie : tant que « modifie » est vrai, toute sortie demande confirmation
// (« fort » : gardée aussi entre deux étapes du budget)
export function useSaisieEnCours(modifie: boolean, fort = false) {
  const { signaler } = useContext(Contexte)
  const id = useId()
  useEffect(() => { signaler(id, modifie, fort) }, [id, modifie, fort, signaler])
  useEffect(() => () => signaler(id, false), [id, signaler])
}

export const useGarde = () => useContext(Contexte).demander

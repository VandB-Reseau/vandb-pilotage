// Entrée dans un champ de montant : passe au champ de montant suivant du même écran (ou de la même fenêtre), contenu sélectionné
export function installerChampSuivant(): () => void {
  const touche = (e: KeyboardEvent) => {
    const champ = e.target as HTMLElement | null
    if (e.key !== 'Enter' || e.isComposing || !(champ instanceof HTMLInputElement) || champ.inputMode !== 'decimal') return
    const zone = champ.closest('[role=dialog]') ?? document.querySelector('main')
    if (!zone) return
    const champs = [...zone.querySelectorAll<HTMLInputElement>('input[inputmode=decimal]:not([disabled])')].filter((c) => c.offsetParent !== null)
    const suivant = champs[champs.indexOf(champ) + 1]
    e.preventDefault()
    if (suivant) { suivant.focus(); suivant.select() } else champ.blur()
  }
  document.addEventListener('keydown', touche)
  return () => document.removeEventListener('keydown', touche)
}

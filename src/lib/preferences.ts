import { useState } from 'react'

// Préférence d'affichage gardée dans ce navigateur (lot 27 : période et unité des tableaux) ; sans mémoire possible
// (navigation privée), la valeur par défaut s'applique, sans gêne
export function usePreference<T extends string>(cle: string, defaut: T, valeurs: readonly T[]): [T, (v: T) => void] {
  const [valeur, setValeur] = useState<T>(() => {
    try {
      const v = localStorage.getItem(`pilotage.${cle}`) as T | null
      return v && valeurs.includes(v) ? v : defaut
    } catch { return defaut }
  })
  const changer = (v: T) => {
    setValeur(v)
    try { localStorage.setItem(`pilotage.${cle}`, v) } catch { /* pas de mémoire : rien de grave */ }
  }
  return [valeur, changer]
}

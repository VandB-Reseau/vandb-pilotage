import { createContext } from 'react'

// Lot 36 : la fiche ouverte signale au menu de gauche les parties où il manque quelque chose (pastille orange)
// Lot 43 : et, sous chaque étape du budget, une marque courte de son état (« Fait », « À valider »…)
export const MenuMagasin = createContext<(pastilles: Record<string, boolean>, marques?: Record<string, string>) => void>(() => {})

import { createContext } from 'react'

// Lot 36 : la fiche ouverte signale au menu de gauche les parties où il manque quelque chose (pastille orange)
export const MenuMagasin = createContext<(pastilles: Record<string, boolean>) => void>(() => {})

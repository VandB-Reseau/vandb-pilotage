import type { ReglesCalcul } from './types'

// Règles de calcul du réseau (lot 40, Joseph 02/11/2026) : les seuils de l'atterrissage, du budget, des médianes et des
// alertes, jusque-là écrits dans le code, réglables depuis Paramètres réseau. Valeurs par défaut : celles en service.
export const reglesParDefaut: ReglesCalcul = {
  jeuneMagasin: 18, moisRythme: 4, ecartRythme: 0.15, seuilRythme: 0.15,
  magasinsSaisonnalite: 3, magasinsCalage: 8, magasinsFamille: 3, moisCommerciaux: 3,
}

// Bornes de saisie : nombres entiers (mois, magasins) ou taux. Hors bornes, l'enregistrement est refusé.
export const BORNES_REGLES: Record<keyof ReglesCalcul, { min: number; max: number; taux?: boolean }> = {
  jeuneMagasin: { min: 6, max: 36 },
  moisRythme: { min: 2, max: 6 },
  ecartRythme: { min: 0.05, max: 0.5, taux: true },
  seuilRythme: { min: 0, max: 0.5, taux: true },
  magasinsSaisonnalite: { min: 2, max: 30 },
  magasinsCalage: { min: 3, max: 50 },
  magasinsFamille: { min: 2, max: 30 },
  moisCommerciaux: { min: 1, max: 6 },
}

// Règles d'une année : celles enregistrées, complétées par les valeurs par défaut
export const reglesDe = (p?: { regles?: Partial<ReglesCalcul> } | null): ReglesCalcul => ({ ...reglesParDefaut, ...p?.regles })

// Clés des règles hors bornes (vide : tout est bon)
export function reglesHorsBornes(r: ReglesCalcul): (keyof ReglesCalcul)[] {
  return (Object.keys(BORNES_REGLES) as (keyof ReglesCalcul)[]).filter((k) => {
    const v = r[k], b = BORNES_REGLES[k]
    return !Number.isFinite(v) || v < b.min - 1e-9 || v > b.max + 1e-9 || (!b.taux && !Number.isInteger(v))
  })
}

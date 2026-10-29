// Rendu commun des tableaux de chiffres (29/10/2026, Joseph : « continuité de rendu », sur le modèle du compte de résultat)
export const styleTableau = {
  '& td, & th': { py: 0.75, px: 1, fontSize: '0.8125rem', whiteSpace: 'nowrap' },
  '& td:first-of-type, & th:first-of-type': { pl: 2.5 },
} as const

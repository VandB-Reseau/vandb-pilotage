// Rendu commun des tableaux de chiffres (29/10/2026, Joseph : « continuité de rendu », sur le modèle du compte de résultat).
// Refonte visuelle T1 (2/11/2026) : tableaux aérés, sans quadrillage ni bandes grises ; filets horizontaux fins, lignes de
// total en gras sous un filet (classe « ligne-forte »), mois en cours surligné en jaune pâle (classe « en-cours »),
// ligne survolée légèrement teintée.
export const FOND_EN_COURS = 'rgba(248, 187, 9, 0.16)'
// Fond des lignes clés : vert canard de la charte, très clair (variable définie dans le thème, clair et sombre)
export const FOND_CLE = 'var(--fond-ligne-cle)'
// 2/11/2026 (Joseph) : aussi résultat d'exploitation, résultat net et trésorerie dégagée après emprunts
export const LIGNES_CLES = ['ca', 'marge', 'personnel', 'ebe', 'exploitation', 'net', 'tresorerie']
export const classeLigne = (cle: string, fort?: boolean) => (LIGNES_CLES.includes(cle) ? 'ligne-cle' : fort ? 'ligne-forte' : undefined)
export const styleTableau = {
  '& td, & th': { py: 1, px: 1.25, fontSize: '0.8125rem', whiteSpace: 'nowrap' },
  '& td:first-of-type, & th:first-of-type': { pl: 2.5 },
  '& tbody tr:hover > td:not(:first-of-type):not(.en-cours)': { bgcolor: 'action.hover' },
  '& .en-cours': { backgroundImage: `linear-gradient(${FOND_EN_COURS}, ${FOND_EN_COURS})` },
  '& thead .en-cours': { color: 'text.primary' },
  '& tr.ligne-forte > td': { fontWeight: 700, borderTop: '1px solid', borderTopColor: 'divider' },
  // Lot 38 (Joseph, 02/11/2026) : CA, marge, masse salariale et EBE en gras sur un fond teinté, dans tous les tableaux
  '& tr.ligne-cle > td': { fontWeight: 700, backgroundImage: `linear-gradient(${FOND_CLE}, ${FOND_CLE})` },
  '& tr.ligne-cle > td.en-cours': { backgroundImage: `linear-gradient(${FOND_EN_COURS}, ${FOND_EN_COURS}), linear-gradient(${FOND_CLE}, ${FOND_CLE})` },
  '& tr.ligne-cle:hover > td:not(:first-of-type):not(.en-cours)': { bgcolor: 'transparent' },
  '& tbody tr:last-of-type > td': { borderBottom: 0 },
} as const
